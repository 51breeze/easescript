const Namespace = require("../core/Namespace");
const Expression = require("./Expression");
class LogicalConditionStatement extends Expression{
     constructor(compilation,node,scope,parentNode,parentStack){
          super(compilation,node,scope,parentNode,parentStack);
          this.isLogicalConditionStatement= true;
          this.left = this.createTokenStack( compilation, node.left, scope, node,this );
          this.right = this.createTokenStack( compilation, node.right, scope, node,this );
          this.operator = this.node.operator;
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
          return Namespace.globals.get('void')
     }
     parser(){
          if(super.parser()===false)return false;
          this.left.parser();
          this.right.parser();
     }
}
module.exports = LogicalConditionStatement;