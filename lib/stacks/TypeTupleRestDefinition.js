const Stack = require("../core/Stack");
const TupleType = require("../types/TupleType");
class TypeTupleRestDefinition extends Stack {
    constructor(compilation,node,scope,parentNode,parentStack){ 
        super(compilation,node,scope,parentNode,parentStack);
        this.isTypeTupleRestDefinition= true;
        this.argument = this.createTokenStack(compilation,node.value, scope, node, this);
    }
    freeze(){
        super.freeze();
        this.argument.freeze();
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
           location:this.argument.getLocation(),
           file:this.compilation.file,
       };
    }
    error(code,...args){
        this.argument.error(code,...args);
    }
    warn(code,...args){
        this.argument.warn(code,...args);
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
        return this.getAttribute('type',()=>{
            return new TupleType(this.getGlobalTypeById("array"), this.argument.type(), this, true);
        })
    }

    async parser(){
        return await this.argument.parser();
    }

    value(){
        return this.argument.value();
    }

    raw(){
        return  `...`+this.argument.raw()
    }
}

module.exports = TypeTupleRestDefinition;