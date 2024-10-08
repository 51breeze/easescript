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
        if( this.parentStack.isTypeStatement ||  this.parentStack.isDeclaratorTypeAlias){
            return this.parentStack.definition(ctx);
        }
        ctx = ctx || this.getContext();
        if(ctx.stack === this.expression){
            const desc = this.expression.description();
            if(desc){
                return desc.definition(ctx);
            }
        }
        const type = this.type();
        ctx = ctx || this.getContext();
        let def = {
            comments:this.comments,
            expre:`(type) ${type.toString(ctx)}`,
        }
        return def;
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
            if(this.expression.isIdentifier || this.expression.isMemberExpression){
                return new TypeofType(type, this.expression.value())
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