const Stack = require("../core/Stack");
class StructTableKeyDefinition extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isStructTableKeyDefinition= true;
        this.key = this.createTokenStack(compilation,node.key,scope,node,this);
        this.local = this.createTokenStack(compilation,node.local,scope,node,this);
        this.properties = node.properties.map( item=>this.createTokenStack(compilation,item,scope,node,this) );
    }
    
    definition( context ){
        return null;
    }
    
    value(){
        return this.key.value();
    }

    async parser(){
        return await this.callParser(async ()=>{
            await this.local.parser();
            await this.allSettled(this.properties,async item=>{
                if( !(item.isIdentifier || item.isMemberExpression) ){
                    await item.parser();
                }
            });
        })
    }
}

module.exports = StructTableKeyDefinition;