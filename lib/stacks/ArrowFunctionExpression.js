const FunctionExpression = require("./FunctionExpression");
class ArrowFunctionExpression extends FunctionExpression{
    constructor(compilation,node,scope,parentNode,parentStack){
         super(compilation,node,scope,parentNode,parentStack);
         this.isArrowFunctionExpression=true;
         this.scope.isArrow = true; 
         this.scope.isExpression = !!node.expression;
    }

    parser(){
        if(super.parser()===false)return false;
        if( this.scope.isExpression ){
            let acceptType = this.returnType;
            if( acceptType ){
                acceptType = acceptType.type();
                if( acceptType && !acceptType.isGenericType  && !acceptType.check(this.body) ){
                    this.body.error(1002,this.body.type().toString(),acceptType.toString());
                }
            }
        }
    }

    reference(){
        if(this.scope.isExpression){
            return this.body;
        }
        return super.reference();
    }
    referenceItems(){
        if(this.scope.isExpression){
            return [this.body];
        }
        return super.referenceItems();
    }
}

module.exports = ArrowFunctionExpression;