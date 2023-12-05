const Stack = require("../core/Stack");
const Declarator = require("./Declarator");
class TryStatement extends Stack {

    constructor(compilation,node,scope,parentNode,parentStack)
    { 
        super(compilation,node,scope,parentNode,parentStack);
        this.isTryStatement= true;
        this.param = new Declarator(compilation,node.handler.param,scope,node,this);
        if(node.handler.param){
            scope.define(this.param.value(), this.param);
        }
        this.handler = this.createTokenStack( compilation,node.handler.body, scope, node,this );
        this.block = this.createTokenStack( compilation,node.block, scope, node,this );
        this.finalizer = this.createTokenStack( compilation,node.finalizer, scope, node,this );
    }
    freeze(){
        super.freeze();
        this.block.freeze();
        this.param && this.param.freeze();
        this.handler && this.handler.freeze();
        this.finalizer && this.finalizer.freeze();
    }
    definition(){
        return null;
    }
    async parser(){
        return await this.callParser(async ()=>{
            await this.block.parser();
            this.param && await this.param.parser();
            this.handler && await this.handler.parser();
            this.finalizer && await this.finalizer.parser();
        })
    }
}

module.exports = TryStatement;