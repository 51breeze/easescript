const FunctionExpression = require("./FunctionExpression");
class NewDefinition extends FunctionExpression{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isNewDefinition= true;
        this.module.addDescriptor('constructor', this)
        this.callable = false;
    }

    getLocation(){
        if(this.node.loc){
            const loc = Object.create(this.node.loc)
            loc.end.line = loc.start.line;
            loc.end.column = loc.start.column+3;
            return loc;
        }
        return null;
    }
}

module.exports = NewDefinition;