const Literal = require("../stacks/Literal");
class JSXCdata extends Literal{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.jsxElement = parentStack.jsxElement;
        this.isJSXCdata= true;
    }
}
module.exports = JSXCdata;