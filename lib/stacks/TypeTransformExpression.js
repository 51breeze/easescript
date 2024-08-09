const Expression = require("./Expression");
class TypeTransformExpression extends Expression{
     constructor(compilation,node,scope,parentNode,parentStack){
          super(compilation,node,scope,parentNode,parentStack);
          this.isTypeTransformExpression= true;
          this.argument = this.createTokenStack( compilation, node.argument, scope, node,this );
          this.expression = this.createTokenStack( compilation, node.expression, scope, node,this );
     }
     freeze(){
          super.freeze();
          this.argument.freeze();
          this.expression.freeze();
     }
     definition(ctx){
          return this.expression.definition(ctx);
     }
     description(){
          return this.expression.description();
     }
     reference(){
          return this.expression.reference();
     }
     referenceItems(){
          return this.expression.referenceItems();
     }
     type(){
          return this.argument.type();
     }
     isLiteralType(type){
          if(!type)return false;
          if( type.isLiteralType )return true;
          if( !type.isAliasType )return false;
          const val = type.toString();
          if( val ==='string' || val ==='boolean' || val ==='regexp' || val ==='uint' || val ==='int' || val ==='float' || val ==='number')return true;
          return false;
     }
     getContext(ctx){
          return this.expression.getContext(ctx);
     }
     parser(){
          if(super.parser()===false)return false;
          this.argument.parser();
          this.expression.parser();
          this.expression.setRefBeUsed();
     }
}

module.exports = TypeTransformExpression;