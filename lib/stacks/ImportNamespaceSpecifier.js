const Declarator = require("./Declarator");
const Namespace = require("../core/Namespace");
const LiteralObjectType = require("../types/LiteralObjectType");
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
        let desc = this.description();
        if(desc){
            return desc.definition(ctx)
        }
        let compi = this.parentStack.getResolveCompilation();
        let file = this.parentStack.getResolveFile();
        let location = compi ? compi.stack.getLocation() : null;
        const selection = this.getLocation();
        const def = {
            text:`import * as ${this.value()}`,
            selection,
            location,
            file
        };
        return def;
    }

    hover(ctx){
        let selection = this.getLocation();
        const def = {
            expre:`import * as ${this.value()}`,
            selection
        };
        let desc = this.description();
        if(desc){
            return this.formatHover(def, desc.hover(ctx))
        }
        return def;
    }

    toDefinition(ctx){
        return this.definition(ctx);
    }

    description(){
        return this.getAttribute('description', ()=>{
            if( this.parentStack.source.isLiteral ){
                const compilation = this.parentStack.getResolveCompilation();
                if(compilation){
                    const jsModule = this.parentStack.isResolveJsModule ? this.parentStack.getResolveJSModule() : null;
                    if(jsModule){
                        return jsModule;
                    }
                }
                if( compilation && compilation.stack && compilation.stack.exports.length > 0 ){
                    const properties = new Map();
                    let exportDefault = null;
                    compilation.stack.exports.forEach( stack=>{
                        if(stack.isExportDefaultDeclaration){
                            exportDefault = stack.description();
                        }else if(stack.isExportNamedDeclaration || stack.isExportAllDeclaration){
                            stack.getAllExportDescriptors(stack).forEach( (value,key)=>{
                                properties.set(key, value)
                            })
                        }
                    });
                    if(exportDefault){
                        properties.set('default', exportDefault)
                    }
                    return properties.size > 0 ? new LiteralObjectType( Namespace.globals.get('object'), null, properties) : Namespace.globals.get('object');
                }
                
                const source = this.parentStack.source.value();
                const desc = Namespace.globals.get(source) || Namespace.fetch(source);
                if(desc ){
                    if( desc.isStack && (desc.isDeclaratorFunction || desc.isDeclaratorVariable)){
                        return desc;
                    }else if(Namespace.is(desc)){
                        return desc;
                        // const properties = new Map();
                        // desc.modules.forEach( (value,key)=>{
                        //     if(Module.is(value)){
                        //         properties.set(key, desc);
                        //     }
                        // });
                        // desc.descriptors.forEach( (items, key)=>{
                        //     const desc = items[0]
                        //     if(desc && (desc.isDeclaratorFunction || desc.isDeclaratorVariable)){
                        //         properties.set(key, desc);
                        //     }
                        // });
                        // return new LiteralObjectType( Namespace.globals.get('object'), null, properties);
                    }
                }
                
            }
            return null;
        })
    }

    descriptor(){
        const desc = this.description();
        if(desc && desc.isImportNamespaceSpecifier)return desc.descriptor();
        return desc;
    }
   
    type(){
        const desc = this.description();
        if(desc){
            if(desc.isNamespace)return desc;
            return desc.type();
        }
        return Namespace.globals.get('any');
    }

    localBinding(){
        if( this.node.type ==="Identifier" ){
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
    }

    parser(){
        if(super.parser()===false)return false;
    }

}

module.exports = ImportNamespaceSpecifier;
