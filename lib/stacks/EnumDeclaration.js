const Stack = require("../core/Stack");
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
            
            scope.define(module.id, module);
            module.comments = this.comments;
            module.isEnum = true;
            module.isLocalModule = true;
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
        const module = this.module;

        await this.allSettled(this.imports,async(stack)=>await stack.addImport(this.module, this.parentStack.scope));
        
        if( this.inherit ){
            const inheritModule = await this.loadTypeAsync( this.inherit.value() );
            if( !inheritModule ){
                this.inherit.error(1027,this.inherit.value());
            }else{
                if( Utils.checkDepend(this.module,inheritModule) ){
                    this.inherit.error(1024,this.inherit.value(), this.module.getName(), inheritModule.getName());
                }else{
                    const stackModule = this.compilation.getStackByModule( inheritModule );
                    stackModule.addUseRef(this.inherit);
                }
            }
            module.extends = inheritModule;
            this.increment = inheritModule.increment;
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
            module.addMember(stack.value(), stack, true);
            return stack;
        });
        module.increment = this.increment;
    }

    assignment( value, stack=null ){
        (stack||this).error(1015,this.raw());
    }

    definition(){
        const properties = this.properties.map( item=>{
            return `${item.value()}=${item.init.value()}`;
        })
        const expre = `enum ${this.value()}`;
        return {
            kind:"enum",
            comments:this.comments,
            identifier:this.value(),
            expre:expre,
            location:this.key.getLocation(),
            file:this.compilation.file,
            context:this
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
        this.inherit && this.inherit.parser();
        this.properties.forEach((stack)=>{
            stack.parser();
        });
    }
    value(){
        return this.key.value();
    }
}

module.exports = EnumDeclaration;