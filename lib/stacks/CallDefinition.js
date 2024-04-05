const FunctionExpression = require("./FunctionExpression");
class CallDefinition extends FunctionExpression{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isCallDefinition= true;
        this.module.addDescriptor('#'+this.module.id, this)
        this.callable = true;
    }
}

module.exports = CallDefinition;