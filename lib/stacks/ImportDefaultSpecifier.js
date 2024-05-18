const Declarator = require("./Declarator");
const Namespace = require("../core/Namespace");
class ImportDefaultSpecifier extends Declarator{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node.local,scope,parentNode,parentStack);
        this.isImportDefaultSpecifier= true;
        this._kind = 'const';
    }

    freeze(){
        super.freeze(this);
    }

    definition(ctx){
        const desc = this.description();
        if( desc ){
            return {
                comments:this.comments,
                expre:`(import refers) ${this.value()}:${desc.type().toString(ctx)}`,
                location:this.getLocation(),
                file:this.file
             };

            // const def = desc.definition(ctx);
            // if( def ){
            //     return {
            //         comments:def.comments,
            //         expre:`(import refs) ${this.value()}:${desc.type().toString(ctx)}`,
            //         location:def.location,
            //         file:def.file,
            //     };
            // }
        }
        return {
            expre:`(import refers) ${this.value()}:any`,
        };
    }

    toDefinition(ctx){
        const desc = this.description();
        if(desc){
           const def = desc.definition(ctx)
           return {
              comments:def.comments,
              expre:`(import refers) ${this.value()}:${desc.type().toString(ctx)}`,
              location:def.location,
              file:def.file
           };
        }
  
        return {
           expre:`(import refers) ${this.value()}:any`,
        };
    }

    description(){
        if( this.parentStack.source.isLiteral ){
            const compilation = this.parentStack.getResolveCompilation();
            if( compilation && compilation.stack && compilation.stack.exports.length > 0 ){
                const result = compilation.stack.exports.find( item=>item.isExportDefaultDeclaration );
                if( result ){
                    return result.description();
                }
            }else if(!compilation){
                const source = this.parentStack.source.value();
                const desc = Namespace.globals.get(source);
                if(desc ){
                    if( desc.isModule && desc.isDeclaratorModule ){
                        return desc;
                    }else if( desc.isAliasType ){
                        return desc;
                    }else if( desc.isStack ){
                        return desc;
                    }
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
}

module.exports = ImportDefaultSpecifier;