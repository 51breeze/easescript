const Stack = require("../core/Stack");
class ChainExpression extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isChainExpression= true;
        this.expression = this.createTokenStack( compilation, node.expression, scope, node, this );
    }
    freeze(){
        super.freeze();
        this.expression.freeze();
    }
    definition(){
        return this.expression.definition();
    }
    reference(){
        return this.expression.reference();
    }

    referenceItems(){
        return this.expression.referenceItems();
    }

    description(){
        return this.expression.description();
    }

    type(){
        return this.expression.type();
    }

    getContext(){
        return this.expression.getContext();
    }

    parser(){
        return this.expression.parser();
    }

    value(){
        return this.expression.value();
    }

    raw(){
        return this.expression.raw();
    }
}

module.exports = ChainExpression;