const Expression = require("./Expression");
class TypeAssertExpression extends Expression{
     constructor(compilation,node,scope,parentNode,parentStack){
          super(compilation,node,scope,parentNode,parentStack);
          this.isTypeAssertExpression= true;
          this.left = this.createTokenStack( compilation, node.left, scope, node,this );
          this.right = this.createTokenStack( compilation, node.right, scope, node,this );
     }
     freeze(){
          super.freeze();
          this.left.freeze();
          this.right.freeze();
     }
     definition(ctx){
          return this.left.definition(ctx);
     }
     description(){
          return this.left.description();
     }
     reference(){
          return this.left.reference();
     }
     referenceItems(){
          return this.left.referenceItems();
     }
     type(){
          const type = this.right.type();
          const ctx = this.getContext();
          ctx.make(type);
          return type;
     }
     async parser(){
          return await this.callParser(async ()=>{
               await this.right.parser();
               await this.left.parser();
          })
     }
}

module.exports = TypeAssertExpression;