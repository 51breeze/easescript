const Stack = require("../core/Stack");
class TypeTupleElementDefinition extends Stack {
    constructor(compilation,node,scope,parentNode,parentStack){ 
        super(compilation,node,scope,parentNode,parentStack);
        this.isTypeTupleElementDefinition= true;
        this.key = this.createTokenStack(compilation,node.key,scope,node,this);
        this.init = this.createTokenStack(compilation,node.init,scope,node,this);
    }
    freeze(){
        super.freeze();
        super.freeze( this.key );
        super.freeze( this.init );
    }
    definition(ctx){
       return null;
    }
    description(){
        return this;
    }
    reference(){
        return this;
    }
    referenceItems(){
        return [this];
    }
    setRefBeUsed(){}
    type(){
       return this.init.type();
    }
    parser(){
        if(super.parser()===false)return false;
        this.init.parser();
    }
}

module.exports = TypeTupleElementDefinition;