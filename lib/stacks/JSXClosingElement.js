const Namespace = require("../core/Namespace");
const Stack = require("../core/Stack");
class JSXClosingElement extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isJSXClosingElement= true;
        this.jsxElement = parentStack.jsxElement;
        this.name = this.createTokenStack( compilation, node.name, scope, node,this );
    }
    freeze(){
        super.freeze();
        this.name && this.name.freeze();
    }
    definition( context ){
        const stack = context && context.stack;
        if(this.parentStack && this.parentStack.hasNamespaced ){
            if( stack ){
                const xmlns = this.parentStack.getXmlNamespace();
                const namespace = xmlns && xmlns.value && xmlns.value.value();
                const space = this.parentStack.isProperty ? Namespace.fetch(namespace) : Namespace.create(namespace ,true);
                const desc = this.name.description( space , stack );
                return desc ? desc.definition( context ) : null;
            }else{
                const desc = this.parentStack.description();
                if( desc ){
                    return desc.definition( context );
                }
            }
        }else if( this.parentStack.isJSXElement ){
            return this.parentStack.definition( context );
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
        return this.getGlobalTypeById("void")
    }
    value(){
        return this.name.value();
    }
    parser(){}
}

module.exports = JSXClosingElement;