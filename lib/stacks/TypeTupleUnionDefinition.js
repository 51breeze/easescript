const TypeTupleDefinition = require("./TypeTupleDefinition");
class TypeTupleUnionDefinition extends TypeTupleDefinition {
    constructor(compilation,node,scope,parentNode,parentStack){ 
        super(compilation,node,scope,parentNode,parentStack);
        this.isTypeTupleUnionDefinition= true;
    }
    value(){
        return this.raw();
    }
    raw(){
        const elems = this.elements.map( item=>item.raw() )
        return `(${elems.join(" | ")})[]`;
    }
}
module.exports = TypeTupleUnionDefinition;