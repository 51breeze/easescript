const Stack = require("../core/Stack");
class DoWhileStatement extends Stack{
   constructor(compilation,node,scope,parentNode,parentStack){
      super(compilation,node,scope,parentNode,parentStack);
      this.isDoWhileStatement= true;
      this.condition = this.createTokenStack(compilation,node.test,scope,node,this);
      this.body = this.createTokenStack(compilation,node.body,scope,node,this);
   }
   freeze(){
      super.freeze();
      this.condition.freeze();
      this.body.freeze();
   }
   definition(){
      return null;
   }
   parser(){
      if( !super.parser())return false;
      if( !this.condition ){
         this.error(1041);
      }else{
         this.condition.parser();
         this.condition.setRefBeUsed();
         this.body.parser();
         const desc = this.condition.description();
         if( desc.isLiteral ){
            const has = this.body.body.some( item=>item.isReturnStatement || item.isBreakStatement);
            if( !has ){
               this.condition.warn(1042)
            }
         }
      }
      return true;
   }
}

module.exports = DoWhileStatement;