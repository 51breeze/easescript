const Stack = require("../core/Stack");
const Utils = require("../core/Utils");
const ClassScope = require("../scope/ClassScope");
const JSModule = require("../core/JSModule");
class DeclaratorDeclaration extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        scope = new ClassScope(scope);
        super(compilation,node,scope,parentNode,parentStack);
        this._metatypes = [];
        this._annotations = [];
        this.usings  =[];
        this.body = [];
        this._imports =[];
        this.isDeclaratorDeclaration= true;
        this.id = this.createTokenStack(compilation,node.id,scope,node,this);
        this.modifier = this.createTokenStack(compilation,node.modifier,scope,node,this);
        let module= null;
        let idName = this.id.value();
        if(parentStack && parentStack.isModuleDeclaration || parentStack.isExportNamedDeclaration && JSModule.is(this.module)){
            module = this.module.getType(idName);
            if(!module){
                module = compilation.createPureModule(idName);
                module.namespace = this.namespace;
                this.module.setType(idName, module);
            }
        }else{
            module  =compilation.createModule(this.namespace, idName, this.modifier ? this.modifier.value() === 'internal' : false );
        }

        this.module=module;
        this.id.module = module;
        this.inherit   = null;
        this.isFinal = module.isFinal = !!node.final;
        this.static  = this.createTokenStack(compilation,node.static,scope,node,this);
        if( node.extends ){
            this.inherit = this.createTokenStack(compilation,node.extends,scope,node,this);
            if( node.extends.genericity ){
                this.inherit.assignGenerics = node.extends.genericity.map( item=>this.createTokenStack(compilation,item,scope,node,this) );
            }
        }
        this.implements  = (node.implements || []).map((item)=>{
            const stack = this.createTokenStack(compilation,item,scope,node,this);
            if( item.genericity ){
                stack.assignGenerics = item.genericity.map( item=>this.createTokenStack(compilation,item,scope,node,this) );
            }
            return stack;
        });
        scope.parent.define(module.id, module);
        this.genericity  = this.createTokenStack(compilation,node.genericity,scope,node,this);
        this.dynamic = false;
        module.dynamic  = false;
        module.isValid  = true;
        module.static   = !!this.static;
        switch( node.kind ){
            case "class" :
                module.isClass = true;
            break;
            case "interface" :
                module.isInterface = true;
            break;
        }
        compilation.addModuleStack(module,this);
    }

    set metatypes(value){
        value.some( (item)=>{
            item.additional = this;
        });
        this._metatypes = value;
    }

    get metatypes(){
       return this._metatypes;
    }

    set annotations(value){
        value.forEach( annotation=>{
            annotation.additional = this;
        });
        this._annotations = value;
        this.dynamic = value.some( (annotation)=>{
            return annotation.name.toLowerCase() ==="dynamic";
        });
        this.module.dynamic = this.dynamic;
    }

    get annotations(){
        return this._annotations;
    }

    set imports( items ){
        if( Array.isArray(items)){
            items.forEach( item=>{
                if( item.isImportDeclaration ){
                    item.additional = this;
                }
            });
            this._imports = items;
        }
    }

    get imports(){
        return this._imports;
    }

    freeze(){
        super.freeze(this);
        super.freeze(this.id);
        super.freeze(this.inherit);
        super.freeze(this.implements);
        super.freeze(this.imports);
        super.freeze(this.modifier);
        super.freeze(this.genericity);
        super.freeze(this.module);
        super.freeze(this.body);
        (this.body||[]).forEach(stack=>stack.freeze());
    }

    definition(context){
        const module = this.module;
        const kind = module.getModuleKind()
        context = context || this.getContext();
        context.scopeGenerics = true;
        let location = (this.id || this).getLocation();
        if( this.compilation.JSX ){
            const program = this.compilation.stack;
            if( program && program.body[0] ){
                location = program.body[0].getLocation();
            }
        }
        return {
            kind,
            comments:this.comments,
            expre:`${kind} ${module.toString(context)}`,
            location,
            file:this.file
        };
    }

    async createCompleted(){
        const compilation = this.compilation;
        const metatypes = [];
        const annotations = [];
        
        await this.allSettled(this.imports,async(stack)=>await stack.addImport(this.module, this.parentStack.scope));

        if( this.inherit ){
            const inheritModule = await this.loadTypeAsync(this.inherit.value());
            
            if( !inheritModule ){
                this.inherit.error(1027, this.inherit.value() );
            }else{
                if( Utils.checkDepend(this.module,inheritModule) ){
                    this.inherit.error(1024,this.inherit.value(), this.module.getName(), inheritModule.getName());
                }else{
                    this.module.extends = inheritModule;
                    this.compilation.addDependency(inheritModule,this.module );
                    if( this.static ){
                        Object.assign(this.module.methods, inheritModule.methods);
                    }
                }
            }
        }
        
        await this.allSettled(this.implements,async (stack)=>{
            const module = await this.loadTypeAsync(stack.value());
            if( module ){
                this.module.implements.push(module);
                if( !(module.isInterface || module.isDeclarator) ){
                    stack.error(1028,stack.value()) 
                }else{
                    this.compilation.addDependency(module,this.module );
                }
                if( this.static ){
                    Object.assign(this.module.methods, module.methods);
                    Object.assign(this.module.methods, module.members);
                }
            }else {
                stack.error(1029,stack.value())
            }
        });

        (this.node.body||[]).map( item=>{
            const stack = this.createTokenStack( compilation, item, this.scope, this.node,this );
            if( stack.isUseExtendStatement ){
                this.usings.push( stack );
            }else if( stack.isMetatypeDeclaration ){
                metatypes.push( stack );
            }else if( stack.isAnnotationDeclaration ){
                annotations.push( stack );
            }else{
                stack.metatypes = metatypes.splice(0,metatypes.length);
                stack.annotations = annotations.splice(0,annotations.length);
                this.body.push( stack );
            }
        });

        if(this.usings.length>0){
            await this.allSettled(this.usings.map(stack=>stack.createCompleted()))
        }

    }

    mergeModuleGenerics(module, assignGenerics){
        if(!module || !module.isModule)return false;
        if( module.inherit ){
            this.mergeModuleGenerics(module.inherit, assignGenerics);
        }
        const declares =  module.getModuleDeclareGenerics();
        if( declares ){
            const ctx = this.getContext();
            const moduleStack = module.moduleStack;
            if(moduleStack){
                ctx.merge(module.moduleStack.getContext());
            }
            ctx.batch(declares, assignGenerics);

            if( module.implements && module.implements.length > 0){
                module.implements.forEach( imp=>{
                    this.mergeModuleGenerics(imp, assignGenerics)
                })
            }
        }
    }

    genericsCheck(typeModule, assignGenerics, aStack){
        if(!typeModule)return;
        if( assignGenerics && assignGenerics.length > 0 ){
            assignGenerics.forEach( item=>{
                item.parser();
            });
        }
        const stackModule = typeModule.moduleStack;
        const _compilation = typeModule.compilation;
        if(_compilation && _compilation.stack){
            //_compilation.stack.parser();
        }
        
        if( stackModule ){
           
            if(aStack){
                aStack.setRefBeUsed()
            }

            assignGenerics = assignGenerics || [];
            const declareGenerics = stackModule.genericity ? stackModule.genericity.elements : [];
            const requires = declareGenerics.filter( item=>!item.isGenericTypeAssignmentDeclaration );
            let lastStack = assignGenerics[ assignGenerics.length-1 ] || aStack || this.id;
            if( requires.length > assignGenerics.length || assignGenerics.length > declareGenerics.length ){
                if( requires.length === declareGenerics.length ){
                    lastStack.error(1030,typeModule.toString(),requires.length);
                }else{
                    lastStack.error(1031,typeModule.toString(),requires.length,declareGenerics.length);
                }
            }
            if( declareGenerics.length > 0 ){
                assignGenerics.forEach( (item,index)=>{
                    const declareType = declareGenerics[index] && declareGenerics[index].type();
                    if( declareType && declareType.hasConstraint && !declareType.check(item) ){  
                        item.error(1003,item.type().toString(),declareType.toString());
                    }
                });
            }
        }
        this.mergeModuleGenerics(typeModule,assignGenerics);
    }

    value(){
        return this.id.value();
    }

    type(){
        return this.module;
    }

    description(){
        return this;
    }
    
    parser(){
        if(super.parser()===false)return false;

        this.imports.forEach(stack=>{
            stack.parser();
        });

        this.usings.forEach(stack=>{
            stack.parser();
        });

        if( this.genericity ){
            this.genericity.parser();
            this.genericity.setRefBeUsed();
            // const ctx = this.getContext();
            // ctx.declareGenerics(this.genericity);
        }

        this.metatypes.forEach(stack=>{
            stack.parser();
        });

        this.annotations.forEach(stack=>{
            stack.parser();
        });

        if( this.inherit ){
            this.parserDescriptor(this.module.extends[0])
            this.genericsCheck( this.module.extends[0], this.inherit.assignGenerics, this.inherit);
            if( this.module.extends[0] && this.module.extends[0].isFinal ){
                this.inherit.error(1147, this.module.getName(), this.module.extends[0].getName() )
            }
        }

        this.implements.forEach(stack=>{
            const impModule = this.getModuleById(stack.value());
            if(impModule){
                this.parserDescriptor(impModule)
                this.genericsCheck( impModule, stack.assignGenerics, stack);
            }
        });
        this.module.ckeckAllDescriptors();
        this.body.forEach(item=>item.parser());
        
    }
}

module.exports = DeclaratorDeclaration;