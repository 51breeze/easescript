const Stack = require("../core/Stack");
class ParenthesizedExpression extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isParenthesizedExpression= true;
        this.expression = this.createTokenStack(compilation,node.expression,scope,node,this);
    }
    freeze(){
        super.freeze();
        this.expression.freeze();
    }
    definition(context){
        return this.expression.definition(context);
    }
    reference(){
        return this.expression.reference();
    }
    referenceItems(){
        return this.expression.referenceItems();
    }
    type(){
        return this.expression.type();
    }
    description(){
        return this.expression.description();
    }

    getContext(){
        return this.expression.getContext();
    }

    parser(){
        if( super.parser() ){
            if(!this.expression){
                this.error(1079);
            }else{
                this.expression.parser();
                this.expression.setRefBeUsed();
            }
            return true;
        }
        return false;
    }
    value(){
        return this.expression.value();
    }
    raw(){
        return this.expression.raw(); 
    }
}

module.exports = ParenthesizedExpression;