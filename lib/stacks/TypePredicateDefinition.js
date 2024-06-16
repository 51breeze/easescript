const Namespace = require("../core/Namespace");
const Stack = require("../core/Stack");
const PredicateType = require("../types/PredicateType");
class TypePredicateDefinition extends Stack {
    constructor(compilation,node,scope,parentNode,parentStack){ 
        super(compilation,node,scope,parentNode,parentStack);
        this.isTypePredicateDefinition= true;
        this.argument = this.createTokenStack(compilation,node.argument,scope,node,this)
        this.value = this.createTokenStack(compilation,node.value,scope,node,this)
    }
    freeze(){
        super.freeze();
        this.argument.freeze();
        this.value.freeze();
    }
    definition(ctx){
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
            return new PredicateType(Namespace.globals.get('boolean'), this.value, this.argument)
        })
    }
    parser(){
        if(super.parser()===false)return false;
        this.argument.parser();
        this.value.parser();
        const desc = this.argument.description();
        if( !desc ){
            this.argument.error(1083, this.argument.value());
        }else{
            if(!desc.isParamDeclarator){
                this.argument.error(1196, this.argument.value());
            }
            this.argument.setRefBeUsed(desc);
        }
    }

    value(){
        return this.expression.value();
    }

    raw(){
        return this.expression.raw();
    }
}

module.exports = TypePredicateDefinition;