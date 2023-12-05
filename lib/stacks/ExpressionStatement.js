const Stack = require("../core/Stack");
class ExpressionStatement extends Stack{

    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isExpressionStatement= true;
        this.expression = this.createTokenStack(compilation,node.expression,scope,node,this);
    }
    freeze(){
        super.freeze();
        this.expression.freeze();
    }
    definition(){
        return null;
    }
    error(code,...args){
        this.expression.error(code,...args);
    }

    warn(code,...args){
        this.expression.warn(code,...args);
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

    type(ctx){
        return this.expression.type(ctx);
    }

    async parser(){
        await this.expression.parser();
    }
    value(){
        return this.expression.value();
    }

    raw(){
        return this.expression.raw();
    }
}

module.exports = ExpressionStatement;