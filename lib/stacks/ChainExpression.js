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
        if( this.expression ){
            return this.expression.reference();
        }
        return null;
    }

    referenceItems(){
        return this.expression ? this.expression.referenceItems() : [];
    }

    description(){
        if( this.expression ){
            return this.expression.description();
        }
        return null;
    }

    type(){
        return this.expression.type();
    }

    getContext(){
        return this.expression.getContext();
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

module.exports = ChainExpression;