const Stack = require("../core/Stack");
class StructTablePropertyDefinition extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isStructTablePropertyDefinition = true;
        this.assignment = !!node.assignment;
        this.key = this.createTokenStack(compilation,node.key,scope,node,this);
        this.init = this.createTokenStack(compilation,node.init,scope,node,this);
    }

    definition( context ){
        return null;
    }

    parser(){
        if(!super.parser())return false;
        return true;
    }
    
    value(){
        return this.key.value();
    }
}

module.exports = StructTablePropertyDefinition;