const MergeType = require("../core/MergeType");
const Namespace = require("../core/Namespace");
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
               let lType = this.hasNestDescription(this.left) ? null : this.left.type();
               let rType = this.hasNestDescription(this.right) ? null : this.right.type();
               if(isAnd){
                    return rType || Namespace.globals.get('any');
               }
               if(lType && lType.isLiteralType ){
                    if(!lType.value){
                         return rType || Namespace.globals.get('any');
                    }else{
                         return lType;
                    }
               }
               if(lType || rType){
                    const mergeType = new MergeType();
                    mergeType.keepOriginRefs = true;
                    mergeType.add(lType, false, true);
                    mergeType.add(rType);
                    return mergeType.type();
               }
               return Namespace.globals.get('any')
          });
     }
     getContext(){
          return this.getAttribute('getContext', ()=>{
               let isAnd = this.isAndOperator;
               if( isAnd ){
                    return this.right.getContext();
               }
               return this.left.getContext();
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