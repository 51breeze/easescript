const Stack = require("../core/Stack");
const ComputeType = require("../types/ComputeType");
const keySymbol = Symbol("key");
class TypeComputeDefinition extends Stack {
    constructor(compilation,node,scope,parentNode,parentStack){ 
        super(compilation,node,scope,parentNode,parentStack);
        this.isTypeComputeDefinition= true;
        this.object = this.createTokenStack(compilation,node.object,scope,node,this);
        this.property = this.createTokenStack(compilation,node.property,scope,node,this);
        this[keySymbol]={};
    }
    freeze(){
        super.freeze();
        this.object.freeze();
        this.property.freeze();
    }
    definition(){
       const type = this.type();
       return {
           kind:this.kind,
           comments:this.comments,
           expre:`(type) ${type.toString()}`,
           location:(this.prefix||this).getLocation(),
           file:this.compilation.file,
           context:this
       };
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
    type(ctx){
        if( !this[keySymbol]._type ){
            this[keySymbol]._type = new ComputeType(this,this.object.type(),this.property);
        }
        return this[keySymbol]._type.type();
    }
    parser(){
        if(super.parser()===false)return false;
        this.object.parser();
        this.property.parser();
        
    }
}

module.exports = TypeComputeDefinition;