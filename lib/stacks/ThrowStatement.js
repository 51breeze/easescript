const Stack = require("../core/Stack");
class ThrowStatement extends Stack{

    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isThrowStatement= true;
        this.hasThrowStatement = true;
        this.argument = this.createTokenStack(compilation,node.argument,scope,node,this);
    }
    freeze(){
        super.freeze();
        this.argument.freeze();
    }
    definition(){
        return null;
    }
    error(code,...args){
        this.argument.error(code,...args);
    }

    warn(code,...args){
        this.argument.warn(code,...args);
    }

    reference(){
        return null
    }

    referenceItems(){
        return []
    }

    description(){
        return null;
    }

    parser(){
        return this.argument.parser();
    }
    value(){
        return this.argument.value();
    }

    raw(){
        return this.argument.raw();
    }
}

module.exports = ThrowStatement;