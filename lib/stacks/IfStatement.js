const Stack = require("../core/Stack");
const BlockScope = require("../scope/BlockScope");
class IfStatement extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isIfStatement = true;
        this.condition = this.createTokenStack(compilation,node.test,scope,node,this);
        this.consequent = this.createTokenStack(compilation,node.consequent,new BlockScope(scope),node,this);
        this.alternate  = node.alternate ? this.createTokenStack(compilation,node.alternate,new BlockScope(scope),node,this) : null;
        this.hasReturnStatement = false;
        if(this.alternate && this.consequent){
            let alternate = !!(this.alternate.hasReturnStatement || this.alternate.hasThrowStatement);
            let consequent = !!(this.consequent.hasReturnStatement || this.consequent.hasThrowStatement);
            if(!alternate && this.alternate.isBlockStatement){
                alternate = this.alternate.body.some(item=>!!(item.hasReturnStatement || item.hasThrowStatement));
            }
            if(alternate && !consequent && this.consequent.isBlockStatement){
                consequent = this.consequent.body.some(item=>!!(item.hasReturnStatement || item.hasThrowStatement));
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
            this.parseConditionState(this.condition)
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