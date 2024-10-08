const Stack = require("../core/Stack");
const BlockScope = require("../scope/BlockScope");
class WhileStatement extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        scope = new BlockScope(scope);
        super(compilation,node,scope,parentNode,parentStack);
        this.isWhileStatement= true;
        this.condition = this.createTokenStack(compilation,node.test,scope,node,this);
        this.body = this.createTokenStack(compilation,node.body,scope,node,this);
    }
    definition(){
        return null;
    }

    freeze(){
        super.freeze();
        this.condition.freeze();
        this.body.freeze();
    }

    parser(){
        if(super.parser()===false)return false;
        if( this.condition  ){
            this.parseConditionState(this.condition)
            this.condition.parser();
            this.condition.setRefBeUsed();
            const desc = this.condition.description();
            if( this.is(desc) && desc.isLiteral && desc.value() ){
                const find = (body)=>{
                    if( !body )return false;
                    return body.some( item=>{
                        if( item.isReturnStatement || item.isBreakStatement ){
                            return true;
                        }
                        if( item.isIfStatement || item.isWhenStatement ){
                            if(item.consequent)return find(item.consequent.body);
                            if(item.alternate)return find(item.alternate.body);
                        }else if( item.isSwitchStatement ){
                            return find(item.cases);
                        }else if( item.isSwitchCase ){
                            return find(item.consequent);
                        }else if( item.isWhileStatement ){
                            return find(item.body.body);
                        }else if(item.isForInStatement || item.isForOfStatement || item.isForStatement){
                            return find(item.body.body);
                        }
                        return false;
                    });
                }
                if( !find(this.body.body) ){
                    this.condition.warn(1042)
                }
            }
        }else{
            return this.error(1041);
        }
        this.body && this.body.parser();
    }

}

module.exports = WhileStatement;