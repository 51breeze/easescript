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
    parser(){
        if( !super.parser())return false;
        if( !this.condition ){
            this.error(1041);
        }else{
            this.condition.parser();
            this.condition.setRefBeUsed();
        }
        this.consequent && this.consequent.parser();
        if( this.alternate ){
            this.alternate.parser();
        }
        return true;
    }
}

module.exports = IfStatement;