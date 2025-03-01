const Stack = require("../core/Stack");
const Utils = require("../core/Utils");
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
        const self = this.module;
        await this.allSettled(this.imports,async(stack)=>{
            const module = await stack.addImport(this.module, this.parentStack.scope);
            if( module && module.isType ){
                if( this.checkDepend(this.module,module) ){
                    stack.error(1024,stack.value())
                }
            }
        });

        if( this.inherit ){
            let stack = this.inherit;
            let id = stack.value();
            let module = stack.getReferenceModuleType();
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
                    }
                }
            }
            if(module || !load){
                push(module, stack)
            }else if(load){
                this.compilation.hookAsync('compilation.create.done', ()=>{
                    push(stack.getReferenceModuleType(), stack)
                })
            }
        }
       
        const impls = self.implements;
        const pushImp = (module, stack)=>{
            if(module && self !== module){
                if(!(module.isInterface || module.isDeclaratorModule)){
                    stack.error(1028,stack.value()) 
                }else{
                    impls.push(module);
                    this.compilation.addDependency(module, self);
                }
            }else {
                stack.error(1029,stack.value())
            }
        }

        await this.allSettled(this.implements,async (stack)=>{
            let id = stack.value();
            let module = stack.getReferenceModuleType();
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
                    pushImp(stack.getReferenceModuleType(), stack)
                })
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

    // mergeModuleGenerics(module, assignGenerics){
    //     if(!module || !module.isModule)return false;
    //     if( module.inherit ){
    //         this.mergeModuleGenerics(module.inherit, assignGenerics);
    //     }
    //     const declares =  module.getModuleDeclareGenerics();
    //     if( declares ){
    //         const ctx = this.getContext();
    //         const moduleStack = module.moduleStack;
    //         if(moduleStack){
    //             ctx.merge(module.moduleStack.getContext());
    //         }
    //         ctx.batch(declares, assignGenerics);
    //         if( module.implements && module.implements.length > 0){
    //             module.implements.forEach( imp=>{
    //                 this.mergeModuleGenerics(imp, assignGenerics)
    //             })
    //         }
    //     }
    // }

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
        //this.mergeModuleGenerics(typeModule, assignGenerics);
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
            let inherit = this.module.extends[0];
            if(inherit){
                this.inherit.setRefBeUsed(inherit);
                this.genericsCheck(inherit, this.inherit.assignGenerics, this.inherit);

                //继承或者实现的类分配了泛型
                if(this.inherit.assignGenerics && this.inherit.assignGenerics.length > 0){
                    this.module.setAssignGenerics(inherit.type(),  this.inherit.assignGenerics)
                }

            }
        }

        this.implements.forEach(stack=> {
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