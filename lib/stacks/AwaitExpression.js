const Namespace = require("../core/Namespace");
const Utils = require("../core/Utils");
const Expression = require("./Expression");
class AwaitExpression extends Expression{
     constructor(compilation,node,scope,parentNode,parentStack){
          node.name = "await";
          super(compilation,node,scope,parentNode,parentStack);
          this.isAwaitExpression= true;
          this.argument = this.createTokenStack( compilation, node.argument, scope, node, this );
          if( parentStack ){
             parentStack.isAwaitExpression = true;
          }
          let parent = parentStack;
          while(parent && !parent.isFunctionExpression){
               parent.scope.hasChildAwait = true;
               parent.hasAwait=true;
               parent = parent.parentStack;
          }
          if( parent.isFunctionExpression ){
               parent.hasAwait=true;
          }
     }
     freeze(){
          super.freeze();
          this.argument.freeze();
     }
     definition(){
          return null;
     }
     description(){
          return this.argument.description();
     }

     getContext(){
          return this.argument.getContext();
     }

     type(){
          const type = this.argument.type();
          const origin = Utils.getOriginType( type )
          const PromiseType = Namespace.globals.get("Promise");
          if( origin && PromiseType.is(origin) ){
               if( type.isInstanceofType && type.generics[0] ){
                   return type.generics[0].type();
               }else if( type.isClassGenericType ){
                   return type.types[0].type();
               }
          }
          return type;
     }
     parser(){
          if(super.parser()===false)return false;
          this.argument.parser();
          this.argument.setRefBeUsed();
          const stack = this.getParentStack( stack=>stack.isFunctionExpression || this.isModuleStack(stack));
          if(!stack || !(stack.isFunctionExpression && stack.async || stack.isProgram)){
               this.error(1017);
          }
     }
}

module.exports = AwaitExpression;