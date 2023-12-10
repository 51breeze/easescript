const Expression = require("./Expression");
class SequenceExpression extends Expression{
     constructor(compilation,node,scope,parentNode,parentStack){
          super(compilation,node,scope,parentNode,parentStack);
          this.isSequenceExpression= true;
          this.expressions = node.expressions.map( item=>this.createTokenStack( compilation, item, scope, node, this ) );
     }
     freeze(){
          super.freeze();
          super.freeze( this.expressions );
          (this.expressions || []).forEach( stack=>stack.freeze() );
      }
     definition(){
          return null;
     }
     description(){
          return this.expressions.length > 0 ? this.expressions[ this.expressions.length-1 ] : this;
     }
     reference(){
          const description = this.description();
          return description !== this ? description.reference() : this;
     }
     referenceItems(){
          const description = this.description();
          return description !== this ? description.referenceItems() : [this];
     }
     type(ctx){
          return this.expressions.length > 0 && this.expressions[ this.expressions.length-1 ].type(ctx);
     }
     parser(){
          if(super.parser()===false)return false;
          this.expressions.forEach( item=>{
               item.parser();
               item.setRefBeUsed();
          });
     }
}

module.exports = SequenceExpression;