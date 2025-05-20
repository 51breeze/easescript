const Stack = require("../core/Stack");
const ConditionalExpressionType = require("../types/ConditionalExpressionType");
const BlankScope = require("../scope/BlankScope");
class TypeConditionalExpression extends Stack {
    constructor(compilation,node,scope,parentNode,parentStack){ 
        scope = new BlankScope(scope);
        super(compilation,node,scope,parentNode,parentStack);
        this.isTypeConditionalExpression= true;
        this.condition = this.createTokenStack(compilation,node.condition, scope, node, this);
        this.consequent = this.createTokenStack(compilation, node.consequent, scope, node, this);
        this.alternate = this.createTokenStack(compilation, node.alternate, scope, node, this);
    }
    
    definition(ctx){
        
    }

    description(){
        return this;
    }
    reference(){
        return this;
    }
    referenceItems(){
        return [this];
    }
    setRefBeUsed(){}

    type(){
        return this.getAttribute('type', ()=>{
            return new ConditionalExpressionType(this)
        });
    }

    parser(){
        if(super.parser()===false)return false; 
        this.condition.parser();
        this.consequent.parser();
        this.alternate.parser();
    }

    value(){
        return this.raw();
    }

    raw(){
        return super.raw();
    }
}

module.exports = TypeConditionalExpression;