const Stack = require("../core/Stack");
class JSXFragment extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isJSXFragment= true;
        this.jsxRootElement = parentStack.jsxRootElement || this;
        this.children = node.children.map( item=>this.createTokenStack( compilation, item, scope, node, this ) );
    }
    freeze(){
        super.freeze();
        this.children.forEach( item=> item.freeze() );
    }
    definition(){
        return null;
    }
    reference(){
        return this;
    }
    referenceItems(){
        return [this];
    }
    description(){
        return null;
    }
    getXmlNamespace( ns ){
        const xmlns = this.xmlns;
        if( xmlns && ns && xmlns.name.value() === ns ){
            return xmlns;
        }
        return this.parentStack.isJSXElement || this.parentStack.isJSXFragment ? this.parentStack.getXmlNamespace( ns ) : null;
    }
    type(){
        return this.getGlobalTypeById('NodeList');
    }
    parser(){
        if(super.parser()===false)return false;
        this.children.forEach(item=>item.parser())
    }
}

module.exports = JSXFragment;