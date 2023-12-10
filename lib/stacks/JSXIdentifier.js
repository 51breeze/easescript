const Identifier = require("../stacks/Identifier");
class JSXIdentifier extends Identifier{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.jsxElement = parentStack.jsxElement;
        this.isJSXIdentifier= true;
    }
    reference(){return null}
    referenceItems(){
        return [];
    }
    description(){
        return null;
    }
    type(){
        return this.getGlobalTypeById("void")
    }
    definition(context){
        return this.parentStack.definition( context || this.getContext() );
    }
    getAttributeDescription(desc, kind='set'){
        if( desc ){
            return this.compilation.getReference(this.value(),desc,false,kind);
        }
        return null;
    }
}
module.exports = JSXIdentifier;