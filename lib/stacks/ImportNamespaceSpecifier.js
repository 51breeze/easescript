const Declarator = require("./Declarator");
const Namespace = require("../core/Namespace");
class ImportNamespaceSpecifier extends Declarator{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node.local,scope,parentNode,parentStack);
        this.isImportNamespaceSpecifier= true;
        this._kind = 'const';
    }

    freeze(){
        super.freeze(this);
        super.freeze(this.local);
    }

    definition(ctx){
        const compilation = this.parentStack.getResolveCompilation();
        if( compilation ){
            if( compilation.modules.size > 0 ){
                const module = Array.from( compilation.modules.values() )[0];
                return module.definition(ctx);
            }
            return {
                expre:`(refs) ${this.value()}:${this.type().toString()}`,
                location:compilation.stack.getLocation(),
                file:compilation.file,
            };
        }else{
           const desc = this.description();
           if( desc ){
                if( desc.isModule ){
                    const def = desc.definition(ctx);
                    if( def ){
                        return {
                            comments:def.comments,
                            expre:`(refs) ${this.value()}:${desc.type().toString()}`,
                            location:def.location,
                            file:def.file,
                        };
                    }
                    return null;
                }else if( desc.isNamespace ){
                    return {
                        expre:`(namespace) ${this.value()} as ${desc.toString()}`,
                    };
                }
                return {
                    expre:`(refs) ${this.value()}:${desc.type().toString()}`,
                    location:desc.isStack ? desc.getLocation() : this.getLocation(),
                    file:desc.isStack ? desc.file : this.file,
                };
           }
        }
    }

    description(){
        if(this.__desc !== void 0)return this.__desc;
        this.__desc = null;
        if( this.parentStack.source.isLiteral ){
            const compilation = this.parentStack.getResolveCompilation();
            if( compilation && compilation.stack && compilation.stack.exports.length > 0 ){
                const result = compilation.stack.exports.find( item=>item.isExportDefaultDeclaration );
                if( result ){
                    return this.__desc = result.description();
                }
            }else if(!compilation){
                const source = this.parentStack.source.value();
                const desc = Namespace.globals.get(source) || Namespace.fetch(source);
                if(desc ){
                    if( desc.isModule && desc.isDeclaratorModule ){
                        return this.__desc = desc;
                    }else if( desc.isAliasType || desc.isStack ){
                        return this.__desc = desc;
                    }else if( desc.isNamespace ){
                        // const create=( target )=>{
                        //     const properties = new Map( target.modules );
                        //     target.children.forEach((value,key)=>{
                        //         properties.set( key, create(value) );
                        //     });
                        //     return new LiteralObjectType( Namespace.globals.get('object'), null, properties );
                        // }
                        return this.__desc = desc;
                    }
                }
            }
        }
        return null;
    }
   
    type(){
        const desc = this.description();
        if(desc){
            if(desc.isNamespace)return desc;
            return desc.type();
        }
        return this.getGlobalTypeById('any');
    }

    parser(){
        if( !super.parser() )return false;
        if( this.node.type ==="Identifier" ){
            const additional = this.parentStack.additional;
            if( additional ){
                const binding = additional.isDeclaratorVariable   || 
                                additional.isDeclaratorFunction   || 
                                additional.isDeclaratorTypeAlias;
                if(binding){
                    return true;
                }
            }
            const name = this.value();
            if( this.scope.isDefine(name) ){
                const old = this.scope.define(name);
                if( old.compilation === this.compilation && !this.compilation.isDescriptorDocument()){
                    this.error(1025,name);
                }
            }
            this.scope.define(name, this);
        }
    }

}

module.exports = ImportNamespaceSpecifier;
