const Stack = require("../core/Stack");
const Utils = require("../core/Utils");
const EnumType = require("../types/EnumType");
class EnumDeclaration extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isEnumDeclaration= true;
        this.isDeclarator = true;
        this.key = this.createTokenStack(compilation,node.key,scope,node,this);
        this.inherit = this.createTokenStack(compilation,node.extends,scope,node,this);
        this.increment =0;
        this.mapProperties = new Map();
        this.imports = [];
        this._metatypes = [];
        this._annotations = [];
        this.isExpressionDeclare = !(parentStack.isPackageDeclaration || parentStack.isProgram);
        if( !this.isExpressionDeclare ){
            this.modifier = this.createTokenStack(compilation,node.modifier,scope,node);
            const module = this.module = compilation.createModule(this.namespace, this.key.value());
            this.key.module = module;
            this.id = this.key;
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
            this.properties = node.properties.map( (item,index)=>{
                const stack = this.createTokenStack(compilation,item,scope,item,this);
                const lastValue = stack.init && stack.init.value();
                if( !stack.key.isIdentifier ){
                    stack.error(1043,stack.raw());
                }
                if( lastValue ){
                    if( typeof lastValue === "number" ){
                        this.increment = lastValue + 1;
                    }else if( typeof lastValue === "string" ) {
                        this.increment = lastValue;
                    }else{
                        stack.error(1044,stack.raw());
                    }
                }
                if( this.mapProperties.has( stack.value() ) ){
                    stack.error(1045,stack.raw());
                }
                this.mapProperties.set(stack.value(), stack);
                return stack;
            });
            scope.define(this.value(), this);
        }
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
        const compilation = this.compilation;
        const self = this.module;
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
                    }else{
                        module.getStacks().forEach( def=>def.addUseRef(stack))
                        self.extends = module;
                        module.used = true;
                        module.children.push(self);
                        this.compilation.addDependency(module,self);
                        this.increment = module.increment;
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

        this.properties = this.node.properties.map( (item,index)=>{
            const stack = this.createTokenStack(compilation,item,this.scope,item,this);
            const lastValue = stack.init && stack.init.value();
            if( !stack.key.isIdentifier ){
                stack.error(1043,stack.raw());
            }
            if( lastValue ){
                if( typeof lastValue === "number" ){
                    this.increment = lastValue + 1;
                }else if(typeof lastValue === "string" ){
                    this.increment = lastValue;
                }else{
                    stack.error(1044,stack.raw());
                }
            }
            if( this.mapProperties.has( stack.value() ) ){
                stack.error(1045,stack.raw());
            }
            this.mapProperties.set(stack.value(), stack);
            self.addMember(stack.value(), stack, true);
            return stack;
        });
        self.increment = this.increment;
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
        if( this.parentStack.isPackageDeclaration && this.module.isEnum ){
            return this.module;
        }
        return this._type || (this._type = new EnumType(this.getGlobalTypeById("object"),this));
    }
    parser(){
        if(super.parser()===false)return false;
        this.imports.forEach((stack)=>{
            stack.parser();
        });
        this.metatypes.forEach((stack)=>{
            stack.parser();
        });
        this.annotations.forEach((stack)=>{
            stack.parser();
        });
        if(this.inherit){
            this.inherit.parser();
            this.inherit.setRefBeUsed();
        }
        if(this.module){
            this.parserDescriptor(this.module.inherit)
        }
        this.properties && this.properties.forEach((stack)=>{
            stack.parser();
        });
    }
    value(){
        return this.key.value();
    }
}

module.exports = EnumDeclaration;