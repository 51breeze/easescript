const AliasType = require("../types/AliasType");
const Expression = require("./Expression");
class TypeTransformExpression extends Expression{
     constructor(compilation,node,scope,parentNode,parentStack){
          super(compilation,node,scope,parentNode,parentStack);
          this.isTypeTransformExpression= true;
          this.argument = this.createTokenStack( compilation, node.expression, scope, node,this );
          this.expression = this.createTokenStack( compilation, node.value, scope, node,this );
     }
     freeze(){
          super.freeze();
          this.ktypeExpressioney.freeze();
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
          return this.getAttribute('type',()=>{
               type = this.expression.type();
               if( !type || this.isLiteralType(type) || type.isAnyType || type.isNullableType || type.isNeverType ){
                    type = this.argument.type();
               }
               if( type.isLiteralArrayType || type.isLiteralObjectType || type.isTupleType ){
                    type = new AliasType( type, type.target );
                    type.isForceTransformType = true;
               }else if( type.isAliasType ){
                    type = new AliasType(type.inherit, type.target);
                    type.isForceTransformType = true;
               }
               return type;
          })
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
          return this.argument.getContext(ctx);
     }
     async parser(){
          return await this.callParser(async ()=>{
               await this.argument.parser();
               await this.expression.parser();
               this.expression.setRefBeUsed();
          })
     }
}

module.exports = TypeTransformExpression;