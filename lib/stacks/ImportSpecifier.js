const Declarator = require("./Declarator");
const Namespace = require("../core/Namespace");
class ImportSpecifier extends Declarator{
   constructor(compilation,node,scope,parentNode,parentStack){
      super(compilation,node.local,scope,parentNode,parentStack);
      this.isImportSpecifier= true;
      this.imported = this.createTokenStack( compilation, node.imported, scope, node, this );
      this._kind = 'const';
   }

   freeze(){
      super.freeze(this);
      super.freeze(this.imported);
   }

   get useRefItems(){
      const dataset = this.fetchUseRefItems();
      if( dataset ){
         super.useRefItems.forEach( value=>{
            dataset.add(value)
         })
         return dataset;
      }
      return super.useRefItems;
   }

   fetchUseRefItems(){
        if(!this.parentStack.source.isLiteral)return null;
        const compilation = this.parentStack.getResolveCompilation();
        if(compilation)return null;
        const source = this.parentStack.source.value();
        const desc = Namespace.fetch(source);
        if(desc && desc.isNamespace){
            const dataset = new Set();
            desc.getDescriptor(this.imported.value(), (desc)=>{
                if( desc.isStack && desc.useRefItems){
                    desc.useRefItems.forEach( (value)=>{
                        dataset.add(value);
                    });
                }
            });
            return dataset;
        }
        return null;
   }

   definition(ctx){
      const desc = this.description();
      if(desc){
         if( desc.isExportAllDeclaration ){
            const compilation = desc.getResolveCompilation();
            return {
               comments:compilation.stack.comments,
               expre:`(refs) ${this.value()}:${this.type().toString()}`,
               location:compilation.stack.getLocation(),
               file:compilation.file
            };
         }
         const def = desc.definition(ctx);
         if( def ){
            return {
               comments:def.comments,
               expre:`(refs) ${this.value()}:${desc.type().toString()}`,
               location:def.location,
               file:def.file
            };
         }
         return null;
      }
   }
   
   description(){
      if( this.parentStack.source.isLiteral ){
         const compilation = this.parentStack.getResolveCompilation();
         if( compilation && compilation.stack && compilation.stack.exports.length > 0 ){
            const imported = this.imported.value();
            const exports = compilation.stack.exports;
            for(var i=0; exports.length > i; i++){
               const item = exports[i];
               if( item.isExportAllDeclaration && item.exported && item.exported.value() === imported ){
                  return item;
               }else if( item.isExportNamedDeclaration ){
                  const desc = item.getDescByName( imported );
                  if( desc )return desc;
               }
            }
         }else if( !compilation ){
            const source = this.parentStack.source.value();
            const desc = Namespace.fetch(source);
            if(desc){
               const imports = desc.imports;
               if( Array.isArray(imports) && imports.some( imp=>imp===this.parentStack ) ){
                  return null;
               }
               return this.parentStack.getDescByName(desc, this.imported.value() );
            }
         }
      }
      return null;
   }

   type(){
      const desc = this.description();
      if(desc)return desc.type();
      return this.getGlobalTypeById('any');
   }

   localBinding(){
      const name = this.value();
      const additional = this.parentStack.additional;
      if( additional ){
         const binding = additional.isDeclaratorVariable   || 
                        additional.isDeclaratorFunction   || 
                        additional.isDeclaratorTypeAlias;
         if(binding){
            return true;
         }
      }
      if( this.scope.isDefine(name) ){
         const old = this.scope.define(name);
         if( old.compilation === this.compilation && !this.compilation.isDescriptorDocument()){
            this.error(1025,name);
         }
      }
      this.scope.define(name, this);
   }

   parser(){
      if(super.parser()===false)return false;
      const desc = this.description();
      if(!desc){
         const compilation = this.parentStack.getResolveCompilation();
         if(compilation){
            this.error(1164, this.parentStack.source.value(), this.imported.value() );
         }
      }
   }
}

module.exports = ImportSpecifier;
