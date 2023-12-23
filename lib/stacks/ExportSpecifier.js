const Stack = require("../core/Stack");
class ExportSpecifier extends Stack{
   constructor(compilation,node,scope,parentNode,parentStack){
      super(compilation,node,scope,parentNode,parentStack);
      this.isExportSpecifier= true;
      this.local = this.createTokenStack( compilation, node.local, scope, node, this );
      this.exported = this.createTokenStack( compilation, node.exported, scope, node, this );
   }

   freeze(){
      super.freeze(this);
      super.freeze(this.exported);
   }

   definition(ctx){
      const desc = this.description();
      if( desc ){
         if( desc.isExportAllDeclaration ){
            const compilation = desc.getResolveCompilation();
            return {
               expre:`import ${desc.exported.value()}`,
               location:compilation.stack.getLocation(),
               file:compilation.file
            };
         }
         return desc.definition(ctx);
      }
   }

   reference(){
      const desc = this.description();
      if( desc && !desc.isExportAllDeclaration ){
         return desc.reference();
      }
      return  null;
   }

   referenceItems(){
      const desc = this.description();
      if( desc && !desc.isExportAllDeclaration ){
         return desc.referenceItems();
      }
      return [];
   }

   description(){
      if( this.parentStack.source ){
         const compilation = this.parentStack.getResolveCompilation();
         if( compilation && compilation.stack && compilation.stack.exports.length > 0 ){
            const local = this.local.value();
            const exports = compilation.stack.exports;
            for(var i=0; exports.length > i; i++){
               const item = exports[i];
               if( item.isExportAllDeclaration && item.exported && item.exported.value() === local ){
                  return item;
               }else if( item.isExportNamedDeclaration ){
                  const desc = item.getDescByName( local );
                  if( desc )return desc;
               }
            }
         }
         return null;
      }
      return this.local.description();
   }

   type(){
      const desc = this.description();
      if( desc )return desc.type();
      return this.getGlobalTypeById('any');
   }

   parser(){
      if(super.parser()===false)return false;
      if( !this.parentStack.source ){
         this.local.parser();
         this.local.setRefBeUsed();
      }
   }
}

module.exports = ExportSpecifier;
