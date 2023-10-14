const AliasType = require("../types/AliasType");
const Expression = require("./Expression");
class TypeTransformExpression extends Expression{
     constructor(compilation,node,scope,parentNode,parentStack){
          super(compilation,node,scope,parentNode,parentStack);
          this.isTypeTransformExpression= true;
          this.typeExpression = this.createTokenStack( compilation, node.expression, scope, node,this );
          this.referExpression = this.createTokenStack( compilation, node.value, scope, node,this );
     }
     freeze(){
          super.freeze();
          this.ktypeExpressioney.freeze();
          this.referExpression.freeze();
     }
     definition(ctx){
          return this.referExpression.definition(ctx);
     }
     description(){
          return this.referExpression.description();
     }
     reference(){
          return this.referExpression.reference();
     }
     referenceItems(){
          return this.referExpression.referenceItems();
     }
     type(ctx){
          let type = this.__type;
          if( type )return type;
          type = this.referExpression.type(ctx);
          if( !type || this.isLiteralType(type) || type.isAnyType || type.isNullableType || type.isNeverType ){
               type = this.typeExpression.type(ctx);
          }
          if( type.isLiteralArrayType || type.isLiteralObjectType || type.isTupleType ){
               type = new AliasType( type, type.target );
               type.isForceTransformType = true;
          }else if( type.isAliasType ){
               type = new AliasType( type.inherit, type.target );
               type.isForceTransformType = true;
          }
          return this.__type = type;
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
          return this.typeExpression.getContext(ctx);
     }
     parser(){
          this.typeExpression.parser();
          this.referExpression.parser();
          this.referExpression.setRefBeUsed();
     }
}

module.exports = TypeTransformExpression;