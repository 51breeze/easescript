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
        this.abstract = this.createTokenStack(compilation,node.abstract,scope,node,this);
        let module= null;
        let idName = this.id.value();
        if(this.module && JSModule.is(this.module)){
            module = this.module.getType(idName);
            if(!module){
                module = compilation.createPureModule(idName);
                module.namespace = this.namespace;
            }
        }else{
            module = compilation.createModule(
                this.namespace,
                idName,
                Utils.isModifierInternal(this),
                false,
                Utils.isModifierPrivate(this)
            );
        }
        this.module=module;
        this.id.module = module;
        this.isFinal = module.isFinal = !!node.final;
        this.static  = this.createTokenStack(compilation,node.static,scope,node,this);
        this.extends = (node.extends||[]).map(item=>{
            let _extend = this.createTokenStack(compilation,item,scope,node,this);
            if(item.genericity){
                _extend.assignGenerics = item.genericity.map( item=>this.createTokenStack(compilation,item,scope,node,this) );
            }
            return _extend;
        });
        this.inherit  = this.extends[0] || null;
        this.implements  = (node.implements || []).map((item)=>{
            const stack = this.createTokenStack(compilation,item,scope,node,this);
            if( item.genericity ){
                stack.assignGenerics = item.genericity.map( item=>this.createTokenStack(compilation,item,scope,node,this) );
            }
            return stack;
        });
        if(this.extends.length>1){
            this.implements.unshift( ...this.extends.slice(1) );
        }
        this.genericity  = this.createTokenStack(compilation,node.genericity,scope,node,this);
        this.dynamic = false;
        module.dynamic  = false;
        module.isValid  = true;
        module.static   = !!this.static;
        module.isEnum   = false;
        switch( node.kind ){
            case "class" :
                module.abstract   = !!this.abstract;
                module.isClass = true;
                module.isInterface = false;
            break;
            case "interface" :
                this.isInterfaceDecorator = module.isInterfaceDecorator = !!node.decorator;
                module.isInterface = true;
                module.isClass = false;
                module.abstract = false;
             break   
            default :{
                module.abstract = false;
            }
        }
        if(module.isClass){
            scope.parent.define(module.id, module);
        }else if(!scope.parent.isDefine(module.id)){
            scope.parent.define(module.id, module);
        }
        module.addStack(this);
    }

    get kind(){
        return this.node.kind;
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
            if(this.module.isClass && annotation.getLowerCaseName() ==="abstract"){
                this.module.abstract = true
            }
        });
        this._annotations = value;
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
        let items = this.module.getStacks();
        if(items && items.length>1){
            return items.map(stack=>stack._imports||[]).flat()
        }
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
        const self = this.module;
        await this.allSettled(this.imports,async(stack)=>{
            await stack.addImport(this.module, this.parentStack.scope)
            // if(stack.getResolveJSModule() && stack.source.isLiteral){
            //     const id = this.module.id;
            //     const item = stack.specifiers.find(stack=>stack.value()===id)
            //     if(item){
            //         const desc = item.descriptor();
            //         if(desc){
            //             const type = desc.type();
            //             const module = this.module;
            //             if(type !== module && Module.is(type) && type.isDeclaratorModule){
            //                 module.implements.push(type);
            //                 type.getStacks().forEach(stack=>{
            //                     module.addStack(stack);
            //                 })
            //             }
            //         }
            //     }
            // }
        });

        if( this.inherit ){
            let stack = this.inherit;
            let id = stack.value();
            let module = stack.getReferenceType();
            let load = false;
            let local = stack.isMemberExpression ? stack.getFirstMemberStack().value() : id;
            if(!this.scope.isDefine(local)){
                module = await this.loadTypeAsync(id);
                load = true;
            }
            let push = (module, stack)=>{
                if( !module ){
                    stack.error(1027, id);
                }else{
                    if( Utils.checkDepend(self,module) ){
                        stack.error(1024,id, self.getName(), module.getName());
                    }else{
                        self.extends = module;
                        module.used = true;
                        module.children.push(self);
                        this.compilation.addDependency(module,self);
                        if( this.static ){
                            Object.assign(self.methods, module.methods);
                        }
                    }
                }
            }
            if(module || !load){
                push(module, stack)
            }else if(load){
                this.compilation.hookAsync('compilation.create.done', ()=>{
                    push(stack.getReferenceType(), stack)
                })
            }
        }
       
        let pushImp = (module, stack)=>{
            if(module && self !== module){
                self.implements.push(module);
                if( !(module.isInterface || module.isDeclaratorModule) ){
                    stack.error(1028,stack.value()) 
                }else{
                    this.compilation.addDependency(module, self);
                }
                if( this.static ){
                    Object.assign(self.methods, module.methods);
                    Object.assign(self.methods, module.members);
                }
            }else {
                stack.error(1029,stack.value())
            }
        }

        await this.allSettled(this.implements,async (stack)=>{
            let id = stack.value();
            let module = stack.getReferenceType();
            let load = false;
            let local = stack.isMemberExpression ? stack.getFirstMemberStack().value() : id;
            if(!this.scope.isDefine(local)){
                module = await this.loadTypeAsync(id);
                load = true;
            }
            if(module || !load){
                pushImp(module, stack)
            }else if(load){
                this.compilation.hookAsync('compilation.create.done', ()=>{
                    pushImp(stack.getReferenceType(), stack)
                })
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

    genericsCheck(typeModule, assignGenerics, aStack){
        if(!typeModule)return;
        if( assignGenerics && assignGenerics.length > 0 ){
            assignGenerics.forEach( item=>{
                item.parser();
            });
        }
        const [stackModule, declareGenerics=[]] = typeModule.getModuleDeclareGenerics(false, false, true);
        const _compilation = typeModule.compilation;
        if(_compilation && _compilation.stack){
            //_compilation.stack.parser();
        }
        if( stackModule ){
            if(aStack){
                aStack.setRefBeUsed()
            }
            assignGenerics = assignGenerics || [];
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
        }

        this.metatypes.forEach(stack=>{
            stack.parser();
        });

        this.annotations.forEach(stack=>{
            stack.parser();
        });

        if( this.inherit ){
            let inherit = this.module.getInheritModule();
            if(inherit){
                this.inherit.setRefBeUsed(inherit);
                this.genericsCheck(inherit, this.inherit.assignGenerics, this.inherit);

                //继承或者实现的类分配了泛型
                if(this.inherit.assignGenerics && this.inherit.assignGenerics.length > 0){
                    this.module.setAssignGenerics(inherit.type(),  this.inherit.assignGenerics)
                }

                if( inherit.isFinal ){
                    this.inherit.error(1147, this.module.getName(), inherit.getName() )
                }
            }
        }

        this.implements.forEach(stack=>{
            const impModule = stack.getReferenceModuleType();
            if(impModule){
                stack.setRefBeUsed(impModule);
                this.genericsCheck( impModule, stack.assignGenerics, stack);

                //继承或者实现的类分配了泛型
                if(stack.assignGenerics && stack.assignGenerics.length > 0){
                    this.module.setAssignGenerics(impModule, stack.assignGenerics)
                }
            }
        });
        
        this.module.ckeckAllDescriptors();
        this.body.forEach(item=>item.parser());
        
    }
}

module.exports = DeclaratorDeclaration;