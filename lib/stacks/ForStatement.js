const Stack = require("../core/Stack");
const BlockScope = require("../scope/BlockScope");
class ForStatement extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        scope = new BlockScope(scope);
        super(compilation,node,scope,parentNode,parentStack);
        this.isForStatement= true;
        this.init  = this.createTokenStack(compilation,node.init,scope,node,this);
        this.condition = this.createTokenStack(compilation,node.test,scope,node,this);
        this.update  = this.createTokenStack(compilation,node.update,scope,node,this);
        this.body  = this.createTokenStack(compilation,node.body,scope,node,this);
    }
    freeze(){
        super.freeze();
        this.init && this.init.freeze();
        this.condition && this.condition.freeze();
        this.update && this.update.freeze();
        this.body.freeze();
    }
    definition(){
        return null;
    }
    async parser(){
        return await this.callParser(async ()=>{
            if( this.init ){
                await this.init.parser();
                this.init.setRefBeUsed();
            }
            if( this.condition ){
                await this.condition.parser();
                this.condition.setRefBeUsed();
            }
            if( this.update  ){
                await this.update.parser();
                this.update.setRefBeUsed();
            }
            if( this.body  ){
                await this.body.parser();
            }
        })
    }
}

module.exports = ForStatement;