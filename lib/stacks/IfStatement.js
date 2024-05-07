const Stack = require("../core/Stack");
const BlankScope = require("../scope/BlankScope");
class IfStatement extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isIfStatement = true;
        this.condition = this.createTokenStack(compilation,node.test,scope,node,this);
        const _scope = node.consequent?.type ==='BlockStatement' ? scope : new BlankScope(scope);
        this.consequent = this.createTokenStack(compilation,node.consequent, _scope ,node,this);
        this.alternate  = this.createTokenStack(compilation,node.alternate,scope,node,this);
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

    getConditions(stack){
        if(stack.isLogicalExpression){
            return [this.getConditions(stack.left ), this.getConditions( stack.right)].flat();
        }
        return [stack];
    }
    parser(){
        if(super.parser()===false)return false;
        if( !this.condition ){
            this.error(1041);
        }else{
            this.condition.parser();
            this.condition.setRefBeUsed();
            const scope = this.consequent.scope;
            this.getConditions(this.condition).forEach(stack=>{
                if(!(stack.isIdentifier || stack.isMemberExpression))return;
                const desc = stack.description();
                if(desc){
                    let value = true;
                    if( stack.isUnaryExpression && stack.operator.charCodeAt(0) === 33){
                        value = stack.operator.length === 2;
                    }
                    const old = scope.getValidateState(desc, true);
                    if(old && old.value !== value){
                        stack.warn(1191);
                        old.expr.warn(1191);
                    }else{
                        scope.setValidateState(desc, this, value, stack)
                    }
                }
            });
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