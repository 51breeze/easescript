const JSModule = require("../core/JSModule");
const Module = require("../core/Module");
const Namespace = require("../core/Namespace");
const Stack = require("../core/Stack");
const Utils = require("../core/Utils");
class ImportDeclaration extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isImportDeclaration= true;
        this.source = this.createTokenStack( compilation, node.source, scope, node, this );
        this.specifiers = node.specifiers.map( item=>this.createTokenStack( compilation, item, scope, node, this ) );
        this.alias = this.createTokenStack( compilation, node.alias, scope, node,this );
        this.importDescriptor = null;
        this.isResolveJsModule = false;
        this.bindingToNamespace = false;
        this.hasImporterDescriptor = false;
        this._hasMatchAutoImporter = false;
        if(!this.compilation.isDescriptorDocument()){
            this.compilation.hookAsync('compilation.parser.after',async ()=>{
                if(this.specifiers.length>0){
                    this.specifiers.forEach( decl=>{
                        if(!decl.useRefItems.size){
                            decl.unnecessary(1183, decl.value());
                        }
                    });
                }else if(this.source && !this.source.isLiteral){
                    if(!this.useRefItems.size){
                        this.unnecessary(1183, this.source.value());
                    }
                }
            });
        }
    }

    get hasMatchAutoImporter(){
        return this._hasMatchAutoImporter;
    }

    freeze(){
        super.freeze(this);
        super.freeze(this.alias);
        super.freeze(this.source);
        this.specifiers.forEach( item=>item.freeze() );
    }

    set additional(stack){
        this._additional = stack;
    }

    get additional(){
        return this._additional;
    }

    addUseRef(stack){
        super.addUseRef(stack)
        const type = this.type();
        if(type && type.isModule){
            const module = (this.additional||this).module;
            this.compilation.addDependency(type, module);
        }
    }

    definition(ctx){
        const compi = this.getResolveCompilation();
        const file = this.getResolveFile();
        const location = compi ? compi.stack.getLocation() : null;
        const source = this.alias || (this.source.isMemberExpression ? this.source.property : this.source);
        const id = source.isLiteral ? `"${file||source.value()}"` : source.value();
        const def = {
            text:`import ${id}`,
            file,
            location
        }
        if(ctx?.hoverStack === this.source){
            return def;
        }
        let desc = this.description();
        if(desc){
            return desc.definition(ctx);
        }else{
            return def;
        }
    }

    hover(ctx){
        const file = this.getResolveFile();
        const source = this.alias || (this.source.isMemberExpression ? this.source.property : this.source);
        const id = source.isLiteral ? `"${file || source.value()}"` : source.value();
        const selection = (ctx?.hoverStack || this.source).getLocation();
        const def = {
            text:`import ${id}`,
            selection,
            file
        }
        if(ctx?.hoverStack === this.source){
            return def;
        }
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
        const desc = this.getAttributeAlways('importDescriptor')
        return Module.is(desc) ? desc.type() : desc; 
    }

    descriptor(){
        return this.description() || this;
    }

    getImportMatchDescriptor(object, property){
        if(!object || !object.isNamespace)return null;
        const result = object.getDescriptor(property, (desc, prev)=>{
            if(desc.isDeclaratorVariable || desc.isDeclaratorFunction){
                return true;
            }
            if(prev && prev.isModuleDeclaration && prev.module){
                return prev
            }
            if(this.isModuleDefinitionStack(prev))return prev;
            return desc;
        });
        if(result){
            if(result.isModuleDeclaration || this.isModuleDefinitionStack(result)){
                return result.module;
            }
            return result;
        }
        return null;
    }

    async addImport( owner, scope ){
        scope = scope || this.scope;
        const add = (key, module, stack)=>{
            if(owner){
                owner.addImport(key, module, module.id != key, scope)
            }
            this.compilation.importModules.set(key, module)
            this.compilation.importModuleNameds.set(module, key)
            module.getStacks().forEach( def=>{
                def.addUseRef(stack);
            });
        }

        if( this.source.isLiteral ){
            const compilation = await this.getResolveCompilationAsync();
            this.specifiers.forEach(item=>{
                item.localBinding();
            });
            if(compilation && compilation.modules.size > 0 && !compilation.isDescriptorDocument()){
                this.compilation.hookAsync('compilation.create.done', ()=>{
                    this.specifiers.forEach(item=>{
                        if(item.isImportNamespaceSpecifier){
                            compilation.modules.forEach( (module)=>{
                                add(compilation.mainModule === module ? item.value() : module.id, module, item)
                            });
                        }else if(item.isImportDefaultSpecifier){
                            const desc = item.descriptor();
                            if(Module.is(desc)){
                                add(item.value(), desc, item);
                            }
                        }else if(item.isImportSpecifier){
                            const module = compilation.modules.get(item.imported.value());
                            if(module){
                                add(item.value(), module, item);
                            }
                        }
                    });
                })
            }
        }else{
            const check = (key, stack)=>{
                let records = scope.define(key);
                if(records){
                    let _records = records;
                    if(this.is(records) && records.parentStack.isImportDeclaration){
                        records = records.parentStack;
                    }
                    if(records.isImportDeclaration){
                        if(records.additional === this.additional){
                            let one = stack;
                            if(stack.isImportDeclaration){
                                one = stack.source.isMemberExpression ? stack.source.property : stack.source
                            }
                            one.error(1025,key);
                            _records.error(1025,key);
                        }
                    }else if(!this.compilation.modules.has(key)){
                        stack.error(1025, key);
                        if(this.is(records)){
                            records.error(1199, key, this.raw())
                        }
                    }
                }
            }

            let sourceId = this.source.value();
            if(this.source.isMemberExpression && sourceId.startsWith('global.')){
                sourceId = sourceId.substring(7);
            }
            let result = Namespace.globals.get(sourceId);
            if(result){
                result = this.compilation.getTypeValue(result, true);
            }else{
                result = await this.compilation.loadTypeAsync(sourceId, null, true);
            }
            let property = this.source.isMemberExpression ? this.source.property.value() : this.source.value();
            let ns =  this.source.isMemberExpression ? Namespace.fetch(this.source.object.value(), null, true) : Namespace.top;
            let nameId = this.alias ? this.alias.value() : property;
            if(result){
                this.setAttributeAlways('importDescriptor', result)
            }
            check(nameId, this)
            scope.define(nameId, this);
            this.compilation.hookAsync('compilation.create.done', ()=>{
                if(!result && ns){
                    result = this.getImportMatchDescriptor(ns, property) || ns.get(property);
                    this.setAttributeAlways('importDescriptor', result)
                }
                if(result && Utils.isTypeModule(result)){
                    add(nameId, result, this)
                }
                if(!this.compilation.isDescriptorDocument()){
                    if(ns && ns.imports.has(property)){
                        this.hasImporterDescriptor = true;
                        this._hasMatchAutoImporter = true;
                        this.addImportSpecifierDependency(ns.imports.get(property), this, nameId)
                    }
                    if(result){
                        let compilation = result.compilation;
                        if(Utils.isCompilation(compilation)){
                            compilation.once('onRemoved',()=>{
                                this.removeAttributeAlways('importDescriptor')
                                this.compiler.printLogInfo(`onRemoved: ${this.toString()}: addImport: ${compilation.file}`, 'Stack')
                            })
                        }
                    }
                }

            });
        }
    }

    getResolveFile(){
        return this.getAttribute('getResolveFile',()=>{
            let source = this.source.isLiteral ? this.source.value() : this.source.value().replace('.', '/');
            let resolve = this.compiler.resolveDescriptorFile(source, this.compilation.file);
            if(!resolve){
                resolve = this.compiler.resolveManager.resolveFile(
                    source, 
                    this.compilation.file
                );
                if(resolve && resolve === this.file){
                    resolve = null
                }
            }
            if(!resolve && this.source.isLiteral){
                resolve = this.source.value();
            }
            return resolve;
        })
    }

    getResolveCompilation(){
        return this.getAttributeAlways('resolveCompilation')
    }

    getResolveJSModule(resolvedCompilation=null){
        return this.getAttributeAlways('getResolveJSModule',()=>{
            if(this.source && this.source.isLiteral){
                let source = this.source.value();
                let resolve = this.getResolveFile();
                let module = JSModule.getModule(source, resolve);
                if(module){
                    return module;
                }
                let raw = source;
                if(resolve && resolve !== source){
                    if(source.includes('/')){
                        source = source.slice(source.lastIndexOf('/')+1)
                    }
                }
                const describeSuffix = this.compiler.options.describeSuffix;
                if(describeSuffix && source.endsWith(describeSuffix)){
                    source = source.substring(0, source.length - describeSuffix.length)
                }
                if(raw !== source){
                    module = JSModule.getModule(source, resolve)
                }
                if(!module && resolvedCompilation){
                    module = JSModule.getByFile(resolvedCompilation.file);
                }
                return module;
            }
            return null;
        })
    }

    async getResolveCompilationAsync(){
        if(this.hasAttributeAlways('resolveCompilation')){
            return this.getAttributeAlways('resolveCompilation')
        }        
        
        let source = this.source.value();
        if(this.compiler.manifester.hasResource(source, true)){
            await this.compilation.loadManifest(source, null, true);
        }

        let hasResolve = this.compiler.checkFileExt(this.getResolveFile());
        let compilation = null;
        if( hasResolve ){
            compilation = await this.compilation.createChildCompilation(this.getResolveFile(), this.compilation.file);
            if(compilation === this.compilation){
                compilation = null;
            }
        }
        
        const jsModule = this.getResolveJSModule(compilation);
        if(jsModule){
            this.isResolveJsModule = true;
            if(!compilation){
                compilation = jsModule.compilation
            }
        }else if(compilation){
            compilation.import = 'importSpecifier';
        }
        
        if(hasResolve && !compilation){
            this.source.error(1132, source);
        }
        if(compilation && !this.compilation.isDescriptorDocument()){
            compilation.once('onRemoved',()=>{
                this.isResolveJsModule = false;
                this.removeAttributeAlways('resolveCompilation')
                this.removeAttributeAlways('getResolveJSModule')
                this.compiler.printLogInfo(`onRemoved: ${this.toString()}: getResolveCompilationAsync: ${compilation.file}`, 'Stack')
            })
        }
        this.setAttributeAlways('resolveCompilation', compilation)
        return compilation;
    }

    getDescByName(desc, key){
        if( !desc || desc.isAnyType )return null;
        if( (desc.isAliasType || desc.isLiteralObjectType) && !desc.isModule ){
            if( desc.isAliasType )desc = desc.inherit;
            if( desc.isLiteralObjectType ){
                return desc.attribute( key );
            }
        }else if( desc.isNamespace ){
            let result =  desc.get(key);
            if(!result){
                result = desc.descriptors.get(key);
                if(result && result[0])return result[0];
            }
            return result;
        }
        return null;
    }

    parser(){
        if(super.parser()===false)return false;
        if( this.source.isLiteral ){
            if(this.specifiers.length>0){
                const compilation = this.getResolveCompilation();
                let len = 0;
                if(compilation){
                    const jsModule = this.isResolveJsModule ? this.getResolveJSModule() : null;
                    if(jsModule){
                        len = jsModule.getExportCount();
                    }else if(compilation.stack){
                        len = compilation.stack.exports.length;
                    }
                }
                let noExported = true;
                this.specifiers.forEach(item=>{
                    item.parser();
                    if(noExported && item.description()){
                        noExported = false;
                    }
                });
                if(compilation && noExported && !(len>0)){
                    this.error(1162, this.source.value());
                }
            }
        }else{
            const desc = this.description();
            if( !desc ){
                this.error(1026, this.source.value());
            }else{
                this.source.setRefBeUsed(desc);
            }
        }
    }

    type(){
        return this.description() || Namespace.globals.get('any');
    }

    value(){
        return this.source.value();
    }
}

module.exports = ImportDeclaration;
