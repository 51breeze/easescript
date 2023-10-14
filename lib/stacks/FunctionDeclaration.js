const FunctionExpression = require("./FunctionExpression");
class FunctionDeclaration extends FunctionExpression{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isFunctionDeclaration= true;
        this.key = this.createTokenStack(compilation,node.id,scope,node,this);
        scope.define( this.key.value(), this );
    }

    freeze(){
        super.freeze();
        this.key.freeze();
        Object.freeze( this.useRefItems );
    }
}

module.exports = FunctionDeclaration;