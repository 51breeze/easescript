const Stack = require("../core/Stack");
class JSXClosingFragment extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isJSXClosingFragment= true;
        this.jsxElement = parentStack.jsxElement;
    }
    definition(){
        return null;
    }
    reference(){
        return null;
    }
    referenceItems(){
        return [];
    }
    description(){
        return null;
    }
    type(){
        return this.getGlobalTypeById("void");
    }
    parser(){}
}

module.exports = JSXClosingFragment;