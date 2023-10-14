const Literal = require("../stacks/Literal");
class JSXText extends Literal{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.jsxElement = this;
        this.isJSXText= true;
    }
}
module.exports = JSXText;