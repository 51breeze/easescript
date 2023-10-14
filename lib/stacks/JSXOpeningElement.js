const Stack = require("../core/Stack");
class JSXOpeningElement extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isJSXOpeningElement= true;
        this.jsxElement = parentStack.jsxElement;
        this.name = this.createTokenStack( compilation, node.name, this.scope, node,this );
        this.attributes = node.attributes.map( item=>this.createTokenStack( compilation, item, this.scope, node, this ) );
        this.selfClosing = !!node.selfClosing;
        this.hasNamespaced = !!(this.name.isJSXNamespacedName || this.name.hasNamespaced);
    }
    freeze(){
        super.freeze();
        this.attributes && this.attributes.forEach( item=>item.freeze() );
        this.name && this.name.freeze();
    }
    getXmlNamespace(ns){
        if( this.parentStack.isJSXElement ){
            return this.parentStack.getXmlNamespace(ns);
        }
        return null;
    }
    definition(context){
        if( this.parentStack.isJSXElement ){
            return this.parentStack.definition(context);
        }
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
        if( !super.parser() )return false;
        this.name.parser();
        this.attributes.forEach( item=> item.parser() );
        return true;
    }
    raw(){
        return this.name.raw();
    }
    value(){
        return this.name.value();
    }
}

module.exports = JSXOpeningElement;