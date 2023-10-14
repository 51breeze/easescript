const Stack = require("../core/Stack");
class JSXSpreadAttribute extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isJSXSpreadAttribute= true;
        this.jsxElement = parentStack.jsxElement;
        this.argument = this.createTokenStack( compilation, node.argument, scope, node,this );
    }
    freeze(){
        super.freeze();
        this.argument && this.argument.freeze();
    }
    definition(){
        return null;
    }
    getAttributeDescription(desc, kind='set'){
        return null;
    }
    reference(){
        return null;
    }
    referenceItems(){
        return [];
    }
    description(){
        return this.argument.description();
    }
    type(){
    }
    parser(){
        this.argument && this.argument.parser();
    }
}

module.exports = JSXSpreadAttribute;