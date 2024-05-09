const MergeType = require("../core/MergeType");
const Expression = require("./Expression");
class LogicalExpression extends Expression{
     constructor(compilation,node,scope,parentNode,parentStack){
          super(compilation,node,scope,parentNode,parentStack);
          this.isLogicalExpression= true;
          this.left = this.createTokenStack( compilation, node.left, scope, node,this );
          this.right = this.createTokenStack( compilation, node.right, scope, node,this );
          this.operator = this.node.operator;
          this.isAndOperator = this.operator ? this.operator.charCodeAt(0) === 38 : false;
     }
     freeze(){
          super.freeze();
          this.left.freeze();
          this.right.freeze();
     }
     definition(){
          return null;
     }
     description(){
          return this;
     }
     type(){
          return this.getAttribute('LogicalExpression.type',()=>{
               let isAnd = this.isAndOperator;
               if( isAnd ){
                    return this.right.type();
               }
               const left = this.left.type();
               if( left.isLiteralType ){
                    if( !left.value ){
                         return this.right.type()
                    }else{
                         return left
                    }
               }
               const mergeType = new MergeType();
               mergeType.keepOriginRefs = true;
               mergeType.add(left, false, true);
               mergeType.add( this.right.type() );
               return mergeType.type();
          });
     }
     parser(){
          if(super.parser()===false)return false;
          this.left.parser();
          this.left.setRefBeUsed();
          this.right.parser();
          this.right.setRefBeUsed();
     }
}
module.exports = LogicalExpression;