const Stack = require("../core/Stack");
class JSXOpeningFragment extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isJSXOpeningFragment= true;
        this.jsxElement = parentStack.jsxElement;
        this.attributes = node.attributes.map( item=>this.createTokenStack( compilation, item, scope, node,this ) );
        this.selfClosing = !!node.selfClosing;
    }
    freeze(){
        super.freeze();
        this.attributes && this.attributes.forEach( item=>item.freeze() );
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
    parser(){
        if(super.parser()===false)return false;
        this.attributes.forEach(item=>{
            item.parser()
        })
    }
}

module.exports = JSXOpeningFragment;