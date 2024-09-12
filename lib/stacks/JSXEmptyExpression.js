const Stack = require("../core/Stack");
class JSXEmptyExpression extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.jsxElement = parentStack.jsxElement;
        this.isJSXEmptyExpression= true;
    }
    definition(){
        return null;
    }
    description(){
        return null;
    }
}
module.exports = JSXEmptyExpression;