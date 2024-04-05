const FunctionExpression = require("./FunctionExpression");
class NewDefinition extends FunctionExpression{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isNewDefinition= true;
        this.module.addDescriptor('constructor', this)
        this.callable = false;
    }
}

module.exports = NewDefinition;