const Stack = require("../core/Stack");
const Utils = require("../core/Utils");
const ClassScope = require("../scope/ClassScope");
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
        const module=this.module=compilation.createModule(this.namespace, this.id.value(), this.modifier ? this.modifier.value() === 'internal' : false );
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
        this.genericity  = this.createTokenStack(compilation,node.genericity,scope,node,this);
        this.dynamic = false;
        module.dynamic   = false;
        module.static   = !!this.static;
        module.comments   = this.comments;
        module.isDeclaratorModule = true;
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

    definition(){
        const kind = "Class";
        return {
            kind:"Module",
            comments:this.comments,
            identifier:this.id.value(),
            expre:`(${kind}) ${this.module.getName()}`,
            location:this.id.getLocation(),
            file:this.file,
            context:this
        };
    }

    createCompleted(){
        const compilation = this.compilation;
        const metatypes = [];
        const annotations = [];

        this.imports.forEach( stack=>{
            stack.parser();
            stack.addImport(this.module, this.parentStack.scope);
        });

        if( this.inherit ){
            const inheritModule = this.getModuleById( this.inherit.value() );
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

        this.module.implements = this.implements.map( (stack)=>{
            const module = this.getModuleById( stack.value() );
            if( module ){
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
            return module;
        });
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
                this.body.push( stack );
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
            _compilation.stack.parser();
        }
        
        if( stackModule ){
            stackModule.addUseRef(aStack);
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
        if( !super.parser() ){
            return false;
        }

        this.usings.forEach( item=>item.parser() );

        if( this.genericity ){
            this.genericity.parser();
            this.genericity.setRefBeUsed();
            const ctx = this.getContext();
            ctx.declareGenerics(this.genericity);
        }

        this.metatypes.forEach( item=>item.parser() )
        this.annotations.forEach( item=>item.parser() );

        if( this.inherit ){
            this.genericsCheck( this.module.extends[0], this.inherit.assignGenerics, this.inherit);
            if( this.module.extends[0] && this.module.extends[0].isFinal ){
                this.inherit.error(1147, this.module.getName(), this.module.extends[0].getName() )
            }
        }
        this.implements.forEach( (stack,index)=>{
            const impModule = this.getModuleById( stack.value() );
            if(impModule){
                this.genericsCheck( impModule, stack.assignGenerics, stack);
            }
        });
        this.body.forEach( item=>item.parser() );
        return true;
    }
}

module.exports = DeclaratorDeclaration;