const Stack = require("../core/Stack");
const TypeofType = require("../types/TypeofType");
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
        if(ctx.stack === this.expression){
            const desc = this.expression.description();
            if(desc){
                return desc.definition(ctx);
            }
        }
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
            let type = this.expression.type()
            if(this.expression.isIdentifier){
                const desc = this.expression.description();
                const pp = this.getParentStack(stack=>!this.isTypeDefinitionStack(stack.parentStack),true);
                if(pp.parentStack === desc || pp.parentStack.parentStack === desc){
                    return new TypeofType(type, this.expression.value())
                }
            }
            return new TypeofType(type)
        })
    }
    parser(){
        if(super.parser()===false)return false;
        this.expression.parser();
        const desc = this.expression.description();
        if( !desc || (desc.isTypeDefinition || desc.isGenericTypeDeclaration || desc.isTypeStatement) ){
            this.expression.error(1083, this.expression.value() );
        }else{
            this.expression.setRefBeUsed(desc);
        }
    }

    value(){
        return this.expression.value();
    }
    raw(){
        return this.expression.raw();
    }
}

module.exports = TypeTypeofDefinition;