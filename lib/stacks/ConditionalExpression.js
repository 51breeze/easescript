const Expression = require("./Expression");
const MergeType = require("../core/MergeType");
const BlankScope = require("../scope/BlankScope");
class ConditionalExpression extends Expression{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isConditionalExpression= true;
        this.test = this.createTokenStack( compilation, node.test, scope, node, this );
        const _scope = node.consequent?.type ==='BlockStatement' ? scope : new BlankScope(scope);
        this.consequent = this.createTokenStack( compilation, node.consequent, _scope, node,this );
        this.alternate = this.createTokenStack( compilation, node.alternate, scope, node,this );
    }
    freeze(){
        super.freeze();
        this.consequent.freeze();
        this.alternate.freeze();
    }
    definition(){
        return null;
    }
    reference(){
        return this;
    }
    referenceItems(){
        return this.consequent.referenceItems().concat( this.alternate.referenceItems() );
    }
    description(){
        return this;
    }
    
    type(){
        return this.getAttribute('ConditionalExpression.type',()=>{
            const mergeType = new MergeType();
            mergeType.add( this.consequent.type() );
            mergeType.add( this.alternate.type() );
            return mergeType.type();
        });
    }

    getConditions(stack){
        if(stack.isLogicalExpression){
            return [this.getConditions(stack.left ), this.getConditions( stack.right)].flat();
        }
        return [stack];
    }

    parser(){
        if(super.parser()===false)return false;
        this.test.parser();
        this.test.setRefBeUsed();
        const scope = this.consequent.scope;
        this.getConditions(this.test).forEach(stack=>{
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

        this.consequent.parser();
        this.consequent.setRefBeUsed();
        this.alternate.parser();
        this.alternate.setRefBeUsed();
    }
}

module.exports = ConditionalExpression;