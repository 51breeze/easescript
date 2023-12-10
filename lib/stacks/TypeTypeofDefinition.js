const Stack = require("../core/Stack");
class TypeTypeofDefinition extends Stack {
    constructor(compilation,node,scope,parentNode,parentStack){ 
        super(compilation,node,scope,parentNode,parentStack);
        this.isTypeTypeofDefinition= true;
        this.expression = this.createTokenStack(compilation,node.value,scope,node,this)
    }
    freeze(){
        super.freeze();
        this.expression.freeze();
    }
    definition(ctx){
        ctx = ctx || this.getContext();
        return this.type().definition(ctx);
    }
    description(){
        return this;
    }
    referenceItems(){
        return [this];
    }
    type(){
        return this.getAttribute('type',()=>{
            let type = this.expression.type();
            let origin = type;
            type = Object.create(type);
            type.toString=function toString(ctx,options){
                if(ctx){
                    return `typeof ${origin.toString(ctx, options)}`
                }
                return origin.toString(ctx,options);
            }
            return type;
        })
        
    }
    parser(){
        if(super.parser()===false)return false;
        this.expression.parser();
        const desc = this.expression.description();
        if( !desc || (desc.isTypeDefinition || desc.isGenericTypeDeclaration || desc.isTypeStatement) ){
            this.expression.error(1083, this.expression.value() );
        }
    }

    value(){
        return this.expression.value();
    }
    raw(){
        return this.expression.value();
    }
}

module.exports = TypeTypeofDefinition;