const Stack = require("../core/Stack");
const TupleType = require("../types/TupleType");
const keySymbol = Symbol("key");
class TypeTupleRestDefinition extends Stack {
    constructor(compilation,node,scope,parentNode,parentStack){ 
        super(compilation,node,scope,parentNode,parentStack);
        this.isTypeTupleRestDefinition= true;
        this.valueType = this.createTokenStack(compilation,node.value, scope, node, this);
        this[keySymbol]={}
    }
    freeze(){
        super.freeze();
        this.valueType.freeze();
    }
    definition(ctx){
       const type = this.type();
       ctx = ctx || this.getContext();
       if( type.isModule ){
           return type.definition(ctx);
       }
       return {
           comments:this.comments,
           expre:`(type) ${type.toString(ctx)}`,
           location:this.valueType.getLocation(),
           file:this.compilation.file,
       };
    }
    error(code,...args){
        this.valueType.error(code,...args);
    }
    warn(code,...args){
        this.valueType.warn(code,...args);
    }
    description(){
        return this;
    }
    referenceItems(){
        return [this];
    }
    setRefBeUsed(){
    }
    type(){
        if( !this[keySymbol]._type ){
            this[keySymbol]._type = new TupleType(this.getGlobalTypeById("array"), this.valueType.type(), this, true);
        }
        return this[keySymbol]._type;
    }

    parser(){
        this.valueType.parser();
    }

    value(){
        return this.valueType.value();
    }

    raw(){
        return  `...`+this.valueType.raw()
    }
}

module.exports = TypeTupleRestDefinition;