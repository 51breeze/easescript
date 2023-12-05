const Stack = require("../core/Stack");
class IfStatement extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isIfStatement = true;
        this.condition = this.createTokenStack(compilation,node.test,scope,node,this);
        this.consequent = this.createTokenStack(compilation,node.consequent,scope,node,this);
        this.alternate  = this.createTokenStack(compilation,node.alternate,scope,node,this);
    }
    freeze(){
        super.freeze(this);
        super.freeze(this.condition);
        super.freeze(this.consequent);
        super.freeze(this.alternate);
    }
    definition(){
        return null;
    }
    async parser(){
        return await this.callParser(async ()=>{
            if( !this.condition ){
                this.error(1041);
            }else{
                await this.condition.parser();
                this.condition.setRefBeUsed();
            }
            if(this.consequent){
                await this.consequent.parser();
            }
            if( this.alternate ){
                await this.alternate.parser();
            }
        })
    }
}

module.exports = IfStatement;