const Namespace = require("../core/Namespace");
const Stack = require("../core/Stack");
const Utils = require("../core/Utils");
const EnumType = require("../types/EnumType");
class EnumDeclaration extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isEnumDeclaration= true;
        this.isDeclarator = true;
        this.key = this.createTokenStack(compilation,node.key,scope,node,this);
        this.increment = 0;
        this.mapProperties = new Map();
        this.imports = [];
        this.body = [];
        this.properties = [];
        this.implements = [];
        this._metatypes = [];
        this._annotations = [];
        this.isExpressionDeclare = !(parentStack.isPackageDeclaration || parentStack.isProgram);
        if( !this.isExpressionDeclare ){
            this.modifier = this.createTokenStack(compilation,node.modifier,scope,node);
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

            const module = this.module = compilation.createModule(this.namespace, this.key.value());
            this.key.module = module;
            scope.define(module.id, module);
            module.static = false;
            module.abstract = false;
            module.isFinal = false;
            module.isClass  = false;
            module.isInterface  = false;
            module.isEnum = true;
            module.increment = this.increment;
            compilation.addModuleStack(module,this);
        }else{
            let lastStack = null;
            this.properties = node.properties.map( (item,index)=>{
                if(!item.init && lastStack){
                    this.increment = Utils.incrementCharacter(lastStack.init.value())
                }
                const stack = this.createTokenStack(compilation,item,scope,this.node,this);
                if(!stack.key.isIdentifier){
                    stack.error(1043,stack.raw());
                }
                if( this.mapProperties.has( stack.value() ) ){
                    stack.error(1045,stack.raw());
                }
                this.mapProperties.set(stack.value(), stack);
                lastStack = stack;
                return stack;
            });
            scope.define(this.value(), this);
        }
    }

    get isExpression(){
        return !(this.parentStack.isPackageDeclaration || this.parentStack.isProgram)
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
        this.module.isFinal = value.some( (annotation)=>{
            return annotation.name.toLowerCase() ==="final";
        });
    }

    get annotations(){
        return this._annotations;
    }

    freeze(){
        super.freeze(this);
        super.freeze(this.properties);
        super.freeze(this.mapProperties);
        if( this.parentStack.isPackageDeclaration ){
            super.freeze(this.id);
            super.freeze(this.module);
            (this.properties||[]).forEach(stack=>stack.freeze());
        }
    }

    async createCompleted(){
        if( this.isExpressionDeclare ){
            return;
        }
        try{
            const compilation = this.compilation;
            const self = this.module;
            const Enumeration = Namespace.globals.get('Enumeration');
            await this.allSettled(this.imports,async(stack)=>await stack.addImport(self, this.parentStack.scope));
            if(this.inherit){
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
                        }else if(Enumeration.is(module)){
                            module.getStacks().forEach( def=>def.addUseRef(stack))
                            self.extends = module;
                            module.used = true;
                            module.children.push(self);
                            this.compilation.addDependency(module,self);
                            this.increment = module.increment;
                        }else{
                            stack.error(1203)
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
            }else{
                self.extends = Enumeration;
            }

            const impls = self.implements = [];
            const pushImp = (module, stack)=>{
                if(module && self !== module){
                    if(!module.isInterface){
                        if(stack)stack.error(1028,stack.value()) 
                    }else{
                        module.used = true;
                        impls.push(module);
                        this.compilation.addDependency(module, self);
                    }
                }else {
                    if(stack)stack.error(1029,stack.value())
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

            let lastStack = null;
            this.node.properties.forEach( (item,index)=>{
                if(!item.init && lastStack){
                    if(lastStack.init && lastStack.init.isLiteral){
                        this.increment = Utils.incrementCharacter(lastStack.init.value())
                    }
                }
                const stack = this.createTokenStack(compilation,item,this.scope,this.node,this);
                if( !stack.key.isIdentifier ){
                    stack.error(1043,stack.raw());
                }
                if( this.mapProperties.has( stack.value() ) ){
                    stack.error(1045,stack.raw());
                }
                this.mapProperties.set(stack.value(), stack);
                self.addMember(stack.value(), stack, true);
                this.properties.push(stack);
                lastStack = stack;
                return stack;
            });
            self.increment = this.increment;

            const metatypes = [];
            const annotations = [];
            (this.node.body||[]).forEach( (item)=>{
                const stack = this.createTokenStack(compilation, item, this.scope, this.node,this);
                if(!stack)return null;
                if( stack.isUseExtendStatement ){
                    
                }else if( stack.isMetatypeDeclaration ){
                    metatypes.push( stack );
                }else if( stack.isAnnotationDeclaration ){
                    annotations.push( stack );
                }else{
                    stack.metatypes   = metatypes.splice(0,metatypes.length);
                    stack.annotations = annotations.splice(0,annotations.length);
                    this.body.push(stack);
                }
            })
        }catch(e){
            this.compilation.throwError(e);
        }
    }

    assignment( value, stack=null ){
        (stack||this).error(1015,this.raw());
    }

    definition(){
        const expre = `enum ${this.value()}`;
        return {
            kind:"enum",
            comments:this.comments,
            expre:expre,
            location:this.key.getLocation(),
            file:this.file
        };
    }
    get attributes(){
        return this.mapProperties;
    }
    attribute(name){
        return this.mapProperties.get(name) || null;
    }
    reference(){
        return this;
    }
    referenceItems(){
        return [this];
    }
    description(){
        return this;
    }
    type(){
        if(this.module && this.module.isEnum){
            return this.module;
        }
        return this.getAttribute('type', ()=>{
            return new EnumType(Namespace.globals.get("object"),this);
        })
    }
    
    genericsCheck(typeModule, assignGenerics, atStack ){
        if(!typeModule)return;
        if( assignGenerics && assignGenerics.length > 0 ){
            assignGenerics.forEach( item=>{
                item.parser();
            });
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
    }

    parser(){
        if(super.parser()===false)return false;
        this.properties.forEach((stack)=>{
            stack.parser();
        });
       
        if(this.isExpressionDeclare){
            if(this.inherit){
                this.inherit.error(1202)
            }
            if(this.implements.length>0){
                this.implements.forEach(stack=>stack.error(1202))
            }
            if( this.body.length>0 ){
                this.body.forEach(stack=>stack.error(1201))
            }
        }else{
            this.imports.forEach((stack)=>{
                stack.parser();
            });

            this.metatypes.forEach((stack)=>{
                stack.parser();
            });

            this.annotations.forEach((stack)=>{
                stack.parser();
            });

            if( this.inherit ){
                const inherit = this.module.getInheritModule();
                if(inherit){
                    this.inherit.setRefBeUsed(inherit);
                    this.genericsCheck(inherit, this.inherit.assignGenerics, this.inherit );

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
                    this.genericsCheck( impModule, stack.assignGenerics, stack );

                    //继承或者实现的类分配了泛型
                    if(stack.assignGenerics && stack.assignGenerics.length > 0){
                        this.module.setAssignGenerics(impModule,  stack.assignGenerics)
                    }
                }
            });

            this.body.forEach( stack=>stack.parser() )
        }
    }

    get id(){
        return this.key;
    }

    value(){
        return this.key.value();
    }
}

module.exports = EnumDeclaration;