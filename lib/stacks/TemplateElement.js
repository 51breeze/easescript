const Stack = require("../core/Stack");
class TemplateElement extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isTemplateElement = true;
    }
    definition(){
        return null;
    }
    reference(){
        return this;
    }
    description(){
        return this;
    }
    referenceItems(){
        return [this];
    }
    type(){
        return this.getGlobalTypeById( 'string' );
    }
    value(){
        return this.node.value.cooked;
    }
    raw(){
        return this.node.value.raw;
    }
}

module.exports = TemplateElement;