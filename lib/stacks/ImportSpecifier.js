const Declarator = require("./Declarator");
const Namespace = require("../core/Namespace");
const Module = require("../core/Module");
const JSModule = require("../core/JSModule");
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
      return dataset || super.useRefItems;
   }

   fetchUseRefItems(){
        if(!this.parentStack.source.isLiteral)return null;
        const compilation = this.parentStack.getResolveCompilation();
        if(compilation)return null;
        const source = this.parentStack.source.value();
        const desc = Namespace.fetch(source, null, true);
        if(desc && desc.isNamespace && desc.descriptors.has(this.imported.value())){
            const dataset = super.useRefItems;
            desc.getDescriptor(this.imported.value(), (desc)=>{
                if( desc.isStack && desc.useRefItems){
                    desc.useRefItems.forEach( (value)=>{
                        if(value && value.compilation === this.compilation){
                           dataset.add(value);
                        }
                    });
                }
            });
            return dataset;
        }
        return null;
   }

   definition(ctx){
      const def = {
         comments:this.comments,
         expre:`import ${this.value()}`,
         location:this.getLocation(),
         file:this.file
      };
      if(!ctx || ctx.stack === this || ctx.stack===this.imported){
         let desc = this.descriptor();
         if(desc){
            if(!desc.isNamespaceDeclaration && !Module.is(desc)){
               if(JSModule.is(desc.module)){
                  const items = desc.module.descriptors.get(desc.value());
                  if(items){
                     return this.definitionMergeToArray(items.map( stack=>stack.definition(ctx)), def)
                  }
               }else if(desc.isDeclaratorFunction && Namespace.is(desc.namespace)){
                  const items = desc.namespace.descriptors.get(desc.value());
                  if(items){
                     return this.definitionMergeToArray(items.map(stack=>stack.definition(ctx)), def)
                  }
               }
            }
            return this.definitionMergeToArray(desc.definition(ctx), def)
         }
      }
      return def
   }

   toDefinition(ctx){
      return this.definition(ctx);
   }

   description(){
      const desc = this.getDescription();
      if(desc && desc.isExportAssignmentDeclaration){
         return null;
      }
      return desc;
   }

   descriptor(){
      const desc = this.description();
      if(desc && desc.isImportSpecifier)return desc.descriptor();
      return desc;
   }
   
   getDescription(){
      return this.getAttribute('getDescription',()=>{
         if( this.parentStack.source.isLiteral ){
            const compilation = this.parentStack.getResolveCompilation();
            if(compilation){
               const jsModule = this.parentStack.isResolveJsModule ? this.parentStack.getResolveJSModule() : null;
               if(jsModule){
                  return jsModule.getExport(this.imported.value());
               }
            }
            if( compilation ){
               if(compilation.stack && compilation.stack.exports.length > 0){
                  const imported = this.imported.value();
                  const exports = compilation.stack.exports;
                  for(var i=0; exports.length > i; i++){
                     const item = exports[i];
                     if( item.isExportAllDeclaration ){
                        const desc = item.getAllExportDescriptors().get(imported);
                        if( desc )return desc;
                     }else if( item.isExportNamedDeclaration ){
                        const desc = item.getDescByName( imported );
                        if( desc )return desc;
                     }else if(item.isExportAssignmentDeclaration){
                        return item;
                     }
                  }
               }

               const source = this.parentStack.source.value();
               const desc = Namespace.fetch(source, null, true);
               if(desc){
                  const key = this.imported.value();
                  const result = desc.descriptors.get(key);
                  if(result && result[0])return result[0];
                  return desc.get(key);
               }

            }else if( !compilation ){
               const source = this.parentStack.source.value();
               const desc = Namespace.fetch(source);
               if(desc){
                  const imports = desc.imports;
                  if( Array.isArray(imports) && imports.some( imp=>imp===this.parentStack ) ){
                     return null;
                  }
                  return this.parentStack.getDescByName(desc, this.imported.value());
               }
            }
         }
         return null;
      })
   }

   type(){
      const desc = this.description();
      if(desc)return desc.type();
      return Namespace.globals.get('any');
   }

   localBinding(){
      const name = this.value();
      const additional = this.parentStack.additional;
      if( additional ){
         const binding = additional.isDeclaratorVariable   || 
                        additional.isDeclaratorFunction   || 
                        additional.isDeclaratorDeclaration  ||
                        additional.isDeclaratorTypeAlias;
         if(binding && additional.value() === name){
            return true;
         }
      }

      if(this.parentStack.parentStack.isPackageDeclaration){
         if(this.compilation.isDescriptorDocument()){
             this.namespace.imports.set(name, this);
             this.parentStack.bindingToNamespace = true;
         }
      }

      if( this.scope.isDefine(name) ){
         const old = this.scope.define(name);
         if(old && old.compilation === this.compilation && !this.compilation.isDescriptorDocument()){
            this.error(1025,name);
         }
      }
      this.scope.define(name, this);
   }

   parser(){
      if(super.parser()===false)return false;
      const desc = this.getDescription();
      if(!desc){
         const compilation = this.parentStack.getResolveCompilation();
         if(compilation){
            (this.imported||this).error(1164, this.parentStack.source.value(), this.imported.value());
         }
      }else{
         if(desc.isExportAssignmentDeclaration){
            (this.imported||this).error(1193, this.parentStack.source.value(), this.imported.value());
         }else{
            (this.imported||this).setRefBeUsed(desc);
         }
      }
   }
}

module.exports = ImportSpecifier;
