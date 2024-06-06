const Declarator = require("./Declarator");
const Namespace = require("../core/Namespace");
const Module = require("../core/Module");
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
                        if(value.compilation === this.compilation){
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
      const desc = this.description();
      if(desc){
         return {
            comments:desc.comments,
            expre:`(import local) ${this.value()}: ${desc.type().toString(ctx)}`,
            location:this.getLocation(),
            file:this.file
         }; 
      }
      return {
         expre:`(import local) ${this.value()}: any`,
         location:this.getLocation(),
         file:this.file
      };
   }

   toDefinition(ctx){
      const desc = this.description();
      if(desc){
            const def = desc.definition(ctx) || {};
            const comments = def.comments || desc.comments;
            const location = def.location || desc.isStack && desc.getLocation();
            const file = def.file || desc.file;
            let type = desc.type().toString(ctx)
            let expre = `(import refers) ${this.value()}: ${type}`;
            if(Module.is(desc)){
               const kind = desc.getModuleKind();
               expre = `(import refers) ${kind} ${type}`;
            }
            return {
                comments:comments,
                expre,
                location,
                file
            };
      }
      return {
         expre:`(import refers) ${this.value()}: any`,
      };
   }
   
   description(){
      if( this.parentStack.source.isLiteral ){
         const compilation = this.parentStack.getResolveCompilation();
         if(compilation){
            const jsModule = this.parentStack.isResolveJsModule ? this.parentStack.getResolveJSModule() : null;
            if(jsModule){
               return jsModule.get(this.imported.value(), this.parentStack.source.value());
            }
         }
         if( compilation && compilation.stack && compilation.stack.exports.length > 0 ){
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
               return this.parentStack.getDescByName(desc, this.imported.value());
            }
         }
      }
      return null;
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
            (this.imported||this).error(1164, this.parentStack.source.value(), this.imported.value() );
         }
      }else{
         (this.imported||this).setRefBeUsed(desc);
      }
   }
}

module.exports = ImportSpecifier;
