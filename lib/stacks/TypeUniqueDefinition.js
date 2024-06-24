const Stack = require("../core/Stack");
const UniqueType = require("../types/UniqueType");
class TypeUniqueDefinition extends Stack {
    constructor(compilation,node,scope,parentNode,parentStack){ 
        super(compilation,node,scope,parentNode,parentStack);
        this.isTypeUniqueDefinition= true;
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
            return new UniqueType(type)
        })
    }
    parser(){
        if(super.parser()===false)return false;
        this.expression.parser();
    }

    value(){
        return this.expression.value();
    }
    raw(){
        return this.expression.raw();
    }
}

module.exports = TypeUniqueDefinition;