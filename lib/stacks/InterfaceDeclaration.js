const Stack = require("../core/Stack");
const ClassScope = require("../scope/ClassScope");
class InterfaceDeclaration extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        scope = new ClassScope(scope);
        super(compilation,node,scope,parentNode,parentStack);
        this.isInterfaceDeclaration= true;
        this._metatypes = [];
        this._annotations = [];
        this.body    =[];
        this.usings  =[];
        this._imports =[];
        this.id = this.createTokenStack(compilation,node.id,scope,node,this);
        const module =this.module=compilation.createModule(this.namespace, this.id.value());
        this.id.module = module;
        this.inherit = this.createTokenStack(compilation,node.extends,scope,node,this);
        if( node.extends && node.extends.genericity ){
            this.inherit.assignGenerics = node.extends.genericity.map( item=>this.createTokenStack(compilation,item,scope,node,this) );
        }
        this.implements  = (node.implements || []).map((item)=>{
            const stack = this.createTokenStack(compilation,item,scope,node,this);
            if( item.genericity ){
                stack.assignGenerics = item.genericity.map( item=>this.createTokenStack(compilation,item,scope,node,this) );
            }
            return stack;
        });
        scope.parent.define(module.id, module);
        this.modifier = this.createTokenStack(compilation,node.modifier,scope,node);
        this.genericity  = this.createTokenStack(compilation,node.genericity,scope,node,this);
        module.isInterface = true;
        compilation.addModuleStack(module,this);
    }

    set metatypes(value){
        value.forEach( item=>{
            item.additional = this;
        });
        if( value.length > 0 ){
            this._metatypes = value;
        }
    }

    get metatypes(){
       return this._metatypes;
    }

    set annotations(value){
        value.forEach( annotation=>{
            annotation.additional = this;
        });
        if( value.length > 0 ){
            this._annotations = value;
        }
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
        super.freeze(this.scope);
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
        context = context || this.getContext();
        context.scopeGenerics = true;
        let location = (this.id || this).getLocation();
        return {
            kind:"interface",
            comments:this.comments,
            expre:`interface ${module.toString(context)}`,
            location,
            file:this.file
        };
    }
    async createCompleted(){
        const compilation = this.compilation;
        await this.allSettled(this.imports,async(stack)=>{
            const module = await stack.addImport(this.module, this.parentStack.scope);
            if( module && module.isType ){
                if( this.checkDepend(this.module,module) ){
                    stack.error(1024,stack.value())
                }
            }
        });

        if( this.inherit ){
            const inheritModule = this.inherit.getReferenceModuleType() || await this.loadTypeAsync( this.inherit.value() );
            if( inheritModule ){
                inheritModule.used = true;
                this.module.extends = inheritModule;
                this.compilation.addDependency(inheritModule,this.module );
            }else{
                this.inherit.error(1027,this.inherit.value());
            }
        }

        await this.allSettled(this.implements, async (stack)=>{
            const module = stack.getReferenceModuleType() || await this.loadTypeAsync( stack.value() );
            if( module ){
                if( !(module.isInterface || module.isDeclarator) ){
                    stack.error(1028,stack.value()) 
                }
                this.module.implements.push(module)
                this.compilation.addDependency(module,this.module );
            }else {
                stack.error(1029,stack.value());
            }
        });

        const metatypes = [];
        const annotations = [];
        (this.node.body||[]).map( item=>{
            const stack = this.createTokenStack( compilation, item, this.scope, this.node,this );
            if( stack.isUseStatement ){
                this.usings.push( stack );
            }else if( stack.isMetatypeDeclaration ){
                metatypes.push( stack );
            }else if( stack.isAnnotationDeclaration ){
                annotations.push( stack );
            }else{
                stack.metatypes = metatypes.splice(0,metatypes.length);
                stack.annotations = annotations.splice(0,annotations.length);
                this.body.push(stack);
            }
        });
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
            const lastStack = assignGenerics[ assignGenerics.length-1 ] || aStack || this.id;
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
        this.mergeModuleGenerics(typeModule, assignGenerics);
    }
    type(){
        return this.module;
    }

    description(){
        return this;
    }
    parser(){
        if(super.parser()===false)return false;

        this.imports.forEach(item=>item.parser() )
        this.usings.forEach(item=>item.parser() )

        if( this.genericity ){
            this.genericity.parser();
            this.genericity.setRefBeUsed();
            // const ctx = this.getContext();
            // ctx.declareGenerics(this.genericity);
        }

        this.metatypes.forEach(item=>item.parser() )
        this.annotations.forEach(item=>item.parser() )

        if( this.inherit ){
            this.parserDescriptor(this.module.extends[0])
            this.genericsCheck( this.module.extends[0], this.inherit.assignGenerics, this.inherit);
        }

        this.implements.forEach(stack=> {
            const impModule = this.getModuleById( stack.value() );
            if( impModule ){
                this.parserDescriptor(impModule)
                this.genericsCheck(impModule, stack.assignGenerics, stack);
            }
        });
        this.body.forEach(item=>item.parser() );
        this.module.ckeckAllDescriptors();
    }
    value(){
        return this.id.value();
    }
    raw(){
        return this.node.name;
    }
}

module.exports = InterfaceDeclaration;