const Stack = require("../core/Stack");
const Utils = require("../core/Utils");
const ClassScope = require("../scope/ClassScope");
class ClassDeclaration extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        scope = scope && scope.type('class') ? scope : new ClassScope(scope);
        super(compilation,node,scope,parentNode,parentStack);
        this.isClassDeclaration= true;
        this._metatypes = [];
        this._annotations= [];
        this._imports     = [];
        this.usings      = [];
        this.body        = [];
        this.id          = this.createTokenStack(compilation,node.id,scope,node,this);
        this.modifier    = this.createTokenStack(compilation,node.modifier,scope,node,this);
        const module = this.module = compilation.createModule(this.namespace, this.id.value(), this.modifier ? this.modifier.value() === 'internal' : false );
        this.id.module= module;
        this.abstract = this.createTokenStack(compilation,node.abstract,scope,node,this);
        this.inherit  = this.createTokenStack(compilation,node.superClass,scope,node,this);
        if( node.superClass && node.superClass.genericity ){
            this.inherit.assignGenerics = node.superClass.genericity.map( item=>this.createTokenStack(compilation,item,scope,node,this) );
        }
        this.isFinal = module.isFinal = !!node.final;
        this.static  = this.createTokenStack(compilation,node.static,scope,node,this);
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
        module.abstract  = !!this.abstract;
        module.isValid   = true;
        module.isClass   = true;
        module.dynamic   = false;
        module.static   = !!this.static;
        module.isInterface  = false;
        module.isEnum  = false;
        compilation.addModuleStack(module,this);
    }

    set metatypes(value){
        value.forEach( item=>{
            item.additional = this;
        })
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
        super.freeze(this.scope);
        super.freeze(this.inherit);
        super.freeze(this.abstract);
        super.freeze(this.metatypes);
        super.freeze(this.annotations);
        super.freeze(this.implements);
        super.freeze(this.imports);
        super.freeze(this.modifier);
        super.freeze(this.genericity);
        super.freeze(this.module);
        super.freeze(this.body);
        this.body.forEach(stack=>stack.freeze());
    }

    async createCompleted(){

        if( this._createCompletedFlag )return;
        this._createCompletedFlag = true;

        try{
            const metatypes = [];
            const annotations = [];
            const compilation = this.compilation;
            const scope = this.scope;
            const node  = this.node;
            const self = this.module;

            await this.allSettled(this.imports,async(stack)=>await stack.addImport(self, this.parentStack.scope));

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
        
            const impls = self.implements = [];
            const pushImp = (module, stack)=>{
                if(module && self !== module){
                    if(!module.isInterface){
                        stack.error(1028,stack.value()) 
                    }else{
                        module.used = true;
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

            (node.body.body || []).forEach( item=>{
                const stack = this.createTokenStack( compilation, item, scope, node ,this);
                if( stack.isUseExtendStatement ){
                    this.usings.push( stack );
                }else if( stack.isMetatypeDeclaration ){
                    metatypes.push( stack );
                }else if( stack.isAnnotationDeclaration ){
                    annotations.push( stack );
                }else{
                    stack.metatypes   = metatypes.splice(0,metatypes.length);
                    stack.annotations = annotations.splice(0,annotations.length);
                    this.body.push( stack );
                }
            });

            if(this.usings.length>0){
                await this.allSettled(this.usings.map(stack=>stack.createCompleted()))
            }

        }catch(e){
            this.compilation.throwError(e);
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

            // const moduleStack = module.moduleStack;
            // if(moduleStack){
            //     ctx.merge(module.moduleStack.getContext());
            // }

            module.getStacks().forEach( item=>{
                ctx.merge(item.getContext());
            })

            ctx.batch(declares, assignGenerics);
            if( module.implements && module.implements.length > 0){
                module.implements.forEach( imp=>{
                    this.mergeModuleGenerics(imp, assignGenerics)
                })
            }
        }
    }

    genericsCheck(typeModule, assignGenerics, atStack ){
        if(!typeModule)return;
        if( assignGenerics && assignGenerics.length > 0 ){
            assignGenerics.forEach( item=>{
                item.parser();
            });
        }

        const _compilation = typeModule.compilation;
        if(_compilation && _compilation.stack){
            //_compilation.stack.parser();
        }

        const [stackModule, declareGenerics=[]] = typeModule.getModuleDeclareGenerics(false, false, true);
        if( stackModule ){
            if(atStack){
                atStack.setRefBeUsed()
            }
            const requires = declareGenerics.filter( item=>!item.isGenericTypeAssignmentDeclaration );
            if( !assignGenerics || !assignGenerics.length ){
                if( declareGenerics.length > 0 ){
                    atStack.error(1030, typeModule.toString(), declareGenerics.length);
                }
            }else{
                const lastStack = assignGenerics[ assignGenerics.length-1 ];
                if( requires.length > assignGenerics.length || assignGenerics.length > declareGenerics.length ){
                    if( requires.length === declareGenerics.length ){
                        lastStack.error(1030, typeModule.toString(), requires.length);
                    }else{
                        lastStack.error(1031,typeModule.toString(), requires.length, declareGenerics.length);
                    }
                }
                if( declareGenerics.length > 0 ){
                    assignGenerics.forEach( (item,index)=>{
                        const declareType = declareGenerics[index] && declareGenerics[index].type();
                        if( declareType && declareType.hasConstraint && !declareType.check(item) ){  
                            item.error(1003,item.type().toString(),declareType.toString(true));
                        }
                    });
                }
            }
        }

        this.mergeModuleGenerics(typeModule, assignGenerics);
    }

    implementCheck(interfaceModule){
        const check = (left,right)=>{
            if( !left )return;
            if(left.modifier && left.modifier.value() ==="private")return;
            const type = left.isAccessor ? (left.kind=='set'?'setter':'getter') : left.isPropertyDefinition ? "property" : "method";
            if( !right ){
                if( left.question ){
                    return;
                }
                const impStack = this.implements.find( (stack)=>{
                    return interfaceModule === this.getModuleById( stack.value() );
                });
                return impStack.error(1032,left.value(),type,interfaceModule.getName(),this.module.getName());
            }

            if( left.isMethodDefinition ){
                if( !right.isMethodDefinition ){
                    right.error(1034,left.value(),type,interfaceModule.getName());
                }else{
                    let lType = left.expression._returnType;
                    let rType = right.expression._returnType;
                    if( !lType && !rType){
                        lType = this.getGlobalTypeById('void');
                        rType = right.inferReturnType();
                    }
                    if( lType && rType && !Utils.checkTypeForBoth(lType.type(),rType.type(), false)){
                        right.error(1033,right.value(),lType.type().toString({scopeGenerics:true}));
                    }
                }

                const paramLen = left.params.length;
                if( paramLen && paramLen != right.params.length ){
                    const requires = left.params.filter( item=>!item.question );
                    if( requires.length > right.params.length ){
                        right.error(1090,left.value(),interfaceModule.getName());
                    }
                }else if( paramLen > 0 ){
                    const lP = left.params[ paramLen-1 ];
                    const rP = right.params[ paramLen-1 ];
                    if( rP ){
                        const lT = !!lP.isRestElement;
                        const rT = !!rP.isRestElement;
                        if( lT !== rT){
                            right.error(1090,left.value(),interfaceModule.getName());
                        }
                    }
                }
                const result = left.params.every( (item,index)=>{
                    if( right.params[index] && !right.params[index].acceptType ){
                        right.params[index].inheritInterfaceAcceptType = item;
                        return true;
                    }
                    const rType = right.params[index] && right.params[index].type();
                    if( !rType && item.question )return true;
                    return rType ? Utils.checkTypeForBoth(item.type(), rType, false ) : false;
                });
                if( !result ){
                    right.error(1036, left.value(),type,interfaceModule.getName());
                }
                const lGens = left.genericity ? left.genericity.elements.length : 0;
                const rGens = right.genericity ? right.genericity.elements.length : 0;
                if( lGens > 0 && lGens !== rGens ){
                    right.error(1037,left.value(), type, interfaceModule.getName());
                }
                if( lGens > 0 ){
                    const result= left.genericity.elements.every( (leftGeneric,index)=>{
                        const rightGeneric = right.genericity.elements[index];
                        if( rightGeneric ){
                            const left = leftGeneric.type();
                            const right = rightGeneric.type();
                            if( left.hasConstraint || right.hasConstraint ){
                                return left.check( rightGeneric, true )
                            }
                            return true;
                        }
                        return false;
                    });
                    if( !result ){
                        right.error(1038,left.value(),type,interfaceModule.getName());
                    }
                }
            }else {
                if( !right.isPropertyDefinition ){
                    right.error(1034, left.value(), type, interfaceModule.getName());
                }else{
                    const lType = left.declarations[0].acceptType;
                    const rType = right.declarations[0].acceptType;
                    if(lType && rType && !Utils.checkTypeForBoth(lType.type(),rType.type(), false)){
                        right.error(1033,right.value(),lType.type().toString({scopeGenerics:true}));
                    }
                }
            }
            if( right.modifier && right.modifier.value() !=="public" ){
                right.error(1039,right.value(),type,interfaceModule.getName());
            }
        }
        if( Utils.isInterface(interfaceModule) && !interfaceModule.isStructTable && interfaceModule !== this.module ){
            const members = interfaceModule.members || {};
            for(var name in members){
                const left = members[name];
                if( left.isAccessor ){
                    check(left.get,this.module.getMember(name,"get",true));
                    check(left.set,this.module.getMember(name,"set",true));
                }else{
                    check(left,this.module.getMember(name,null,true));
                }
            }

            if( interfaceModule.dynamicProperties ){
                interfaceModule.dynamicProperties.forEach( (value,key)=>{
                    this.module.dynamic = true;
                    if( !this.module.dynamicProperties.has(key) ){
                        this.module.dynamicProperties.set(key,value);
                    }
                });
            }
        }
        
        if( Utils.isInterface(interfaceModule) ){
            interfaceModule.extends.forEach( item=>{
                if( !item.isStructTable ){
                    this.implementCheck(item);
                }
            });
        }
        
        (interfaceModule && interfaceModule.implements||[]).forEach( item=>{
            if( !item.isStructTable ){
                this.implementCheck(item);
            }
        });
    }
    definition(context){
        const module = this.module;
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
            kind:"class",
            comments:this.comments,
            expre:`class ${module.toString(context)}`,
            location,
            file:this.file
        };
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

        try{
            this.imports.forEach(stack=>{
                stack.parser();
            });

            this.usings.forEach(stack=>{
                stack.parser();
            })

            if( this.genericity ){
                this.genericity.parser();
                this.genericity.setRefBeUsed();
            }

            if( this.inherit ){
                const inherit = this.module.extends[0];
                if( inherit ){
                    this.inherit.setRefBeUsed(inherit);
                    this.genericsCheck( inherit, this.inherit.assignGenerics, this.inherit );

                    //继承或者实现的类分配了泛型
                    if(this.inherit.assignGenerics && this.inherit.assignGenerics.length > 0){
                        const declareGenerics = inherit.type().getModuleDeclareGenerics();
                        this.module.setAssignGenerics(declareGenerics,  this.inherit.assignGenerics)
                    }

                    if(inherit.isFinal){
                        this.inherit.error(1147, this.module.getName(), inherit.getName())
                    }
                }
            }

            this.metatypes.forEach(stack=>{
                stack.parser();
            })

            this.annotations.forEach(stack=>{
                stack.parser();
            });

            this.implements.forEach(stack=>{
                const impModule = stack.getReferenceModuleType();
                if(impModule){
                    stack.setRefBeUsed(impModule);
                    this.genericsCheck(impModule, stack.assignGenerics, stack );

                    //继承或者实现的类分配了泛型
                    if(stack.assignGenerics && stack.assignGenerics.length > 0){
                        const declareGenerics= impModule.getModuleDeclareGenerics();
                        this.module.setAssignGenerics(declareGenerics, stack.assignGenerics)
                    }
                }
            });

            this.implementCheck( this.module );
            this.module.ckeckAllDescriptors();
            this.body.forEach(stack=>{
                stack.parser();
            });
        }catch(e){
            this.compilation.throwError(e);
        }
    }
}

module.exports = ClassDeclaration;