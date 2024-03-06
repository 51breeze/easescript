const Stack = require("../core/Stack");
class IfStatement extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isIfStatement = true;
        this.condition = this.createTokenStack(compilation,node.test,scope,node,this);
        this.consequent = this.createTokenStack(compilation,node.consequent,scope,node,this);
        this.alternate  = this.createTokenStack(compilation,node.alternate,scope,node,this);
        this.hasReturnStatement = false;
        if(this.alternate && this.consequent){
            let alternate = this.alternate.hasReturnStatement;
            let consequent = this.consequent.hasReturnStatement;
            if(!alternate && this.alternate.isBlockStatement){
                alternate = this.alternate.body.some(item=>!!item.hasReturnStatement);
            }
            if(alternate && !consequent && this.consequent.isBlockStatement){
                consequent = this.consequent.body.some(item=>!!item.hasReturnStatement);
            }
            this.hasReturnStatement = alternate && consequent;
        }
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
        if(super.parser()===false)return false;
        if( !this.condition ){
            this.error(1041);
        }else{
            this.condition.parser();
            this.condition.setRefBeUsed();
        }
        if(this.consequent){
            this.consequent.parser();
        }
        if( this.alternate ){
            this.alternate.parser();
        }
    }
}

module.exports = IfStatement;