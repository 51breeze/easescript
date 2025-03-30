const Declarator = require("./Declarator");
const Namespace = require("../core/Namespace");
const Module = require("../core/Module");
const JSModule = require("../core/JSModule");
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
        let compi = this.parentStack.getResolveCompilation();
        let file =  this.parentStack.getResolveFile();
        let location = compi ? compi.stack.getLocation() : null;
        const selection = this.getLocation();
        const def = {
            text:`import ${this.value()}`,
            file,
            location,
            selection
        };
        const desc = this.descriptor();
        if(desc){
            if(!desc.isNamespaceDeclaration && !Module.is(desc)){
                if(JSModule.is(desc.module)){
                    const items = desc.module.descriptors.get(desc.value());
                    if(items){
                        return items.map( stack=>stack.definition(ctx))
                    }
                }else if(desc.isDeclaratorFunction && Namespace.is(desc.namespace)){
                    const items = desc.namespace.descriptors.get(desc.value());
                    if(items){
                        return items.map(stack=>stack.definition(ctx))
                    }
                }
            }
            return desc.definition(ctx)
        }
        return def;
    }

    hover(ctx){
        const selection = this.getLocation();
        const def = {
            text:`import ${this.value()}`,
            selection
        };
        const desc = this.descriptor();
        if(desc){
            if(!desc.isNamespaceDeclaration && !Module.is(desc)){
                if(JSModule.is(desc.module)){
                    const items = desc.module.descriptors.get(desc.value());
                    if(items){
                        return this.formatHover(def, items.map( stack=>stack.hover(ctx)))
                    }
                }else if(desc.isDeclaratorFunction && Namespace.is(desc.namespace)){
                    const items = desc.namespace.descriptors.get(desc.value());
                    if(items){
                        return this.formatHover(def, items.map(stack=>stack.hover(ctx)))
                    }
                }
            }
            return this.formatHover(def, desc.hover(ctx));
        }
        return def;
    }

    toDefinition(ctx){
        return this.definition(ctx);
    }

    description(){
        return this.getAttribute('description',()=>{
            if( this.parentStack.source.isLiteral ){
                const compilation = this.parentStack.getResolveCompilation();
                if(compilation){
                    const jsModule = this.parentStack.isResolveJsModule ? this.parentStack.getResolveJSModule() : null;
                    if(jsModule){
                        return jsModule.getExport('default');
                    }
                }
                if( compilation){
                    if(compilation.stack && compilation.stack.exports.length > 0){
                        const result = compilation.stack.exports.find( item=>item.isExportDefaultDeclaration );
                        if( result ){
                            return result.description();
                        }
                    }
                }

                const source = this.parentStack.source.value();
                const desc = Namespace.globals.get(source);
                if(desc){
                    if(Module.is(desc)){
                        return desc;
                    }else if(desc.isDeclaratorFunction || desc.isDeclaratorVariable){
                        return desc;
                    }
                }
            }
            return null;
        })
    }

    descriptor(){
        const desc = this.description();
        if(desc && desc.isImportDefaultSpecifier)return desc.descriptor();
        return desc;
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
            if( old && old.compilation === this.compilation && !this.compilation.isDescriptorDocument()){
                this.error(1025,name);
            }
        }
        this.scope.define(name, this);
    }
    parser(){
        if(super.parser()===false)return false;
        const desc = this.description();
        if(desc){
            this.setRefBeUsed(desc);
        }else{
            const compilation = this.parentStack.getResolveCompilation();
            if(compilation){
                this.error(1193, this.parentStack.source.value(), this.value());
            }
        }
    }
}

module.exports = ImportDefaultSpecifier;