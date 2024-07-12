const AutoImporter = require("../core/AutoImporter");
const JSModule = require("../core/JSModule");
const Namespace = require("../core/Namespace");
const Stack = require("../core/Stack");
const LiteralObjectType = require("../types/LiteralObjectType");
class ExportAllDeclaration extends Stack {
    constructor(compilation,node,scope,parentNode,parentStack){ 
        super(compilation,node,scope,parentNode,parentStack);
        this.isExportAllDeclaration = true;
        this.source = this.createTokenStack(compilation, node.source, scope, node, this);
        this.exported = this.createTokenStack(compilation, node.exported, scope, node, this);
        if( parentStack && !(parentStack.isProgram || parentStack.isPackageDeclaration || parentStack.isModuleDeclaration) ){
            this.error(1159);
        }
        let _exports = null
        if(parentStack.isModuleDeclaration && parentStack.module){
            _exports = parentStack.module.exports;
        }else if(this.compilation.isDescriptorDocument()){
            _exports = this.namespace.exports;
        }
        if(_exports){
            const key = this.exported ? this.exported.value() : '*';
            if(_exports.has(key)){
                (this.exported||this).error(1195, key, this.namespace.toString())
            }else{
                _exports.set(key, this)
            }
        }
    }

    definition(ctx={}){
        if(this.source){
            let source = this.source.value();
            let location =this.source.getLocation();
            let file = this.file;
            const def = {
                text:`import "${source}"`,
                location,
                file,
                range:this.source.getLocation()
            };   
            if(!ctx || ctx.stack === this.source ){
                let jsModule = this.getResolveJSModule();
                if(jsModule){
                    return jsModule.definition(ctx)
                }
            }else if(this.exported === ctx.stack){
                def.text = `import ${this.exported.value()}`;
                let jsModule = this.getResolveJSModule();
                if(jsModule){
                    return this.definitionMergeToArray(jsModule.definition(ctx), def);
                }
            }
            return def;
        }
    }

    type(){
        return this.getAttribute('type',()=>{
            return new LiteralObjectType( Namespace.globals.get('object'), null, this.getAllDescriptors())
        })
    }
   
    getResolveFile(){
        if( this.source && this.source.isLiteral ){
            if(this.resolve !== void 0)return this.resolve;
            const source = this.source.value();
            let resolve = this.compiler.resolve(source, this.compilation.file);
            if(!resolve){
                resolve = this.compiler.resolveDescriptorFile(source, this.compilation.file);
            }
            this.resolve = resolve || source;
            if( !resolve && !JSModule.get(source)){
                this.source.error(1122, source);
            }
            return this.resolve;
        }
    }

    getResolveCompilation(){
        return this._resolveCompilation;
    }

    getResolveJSModule(){
        return this.getAttribute('getResolveJSModule',()=>{
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
                    return JSModule.getModule(source, resolve);
                }
            }
            return null;
        })
    }

    async getResolveCompilationAsync(){
        if(!this.source)return null;
        if(this._resolveCompilation !== void 0){
            return this._resolveCompilation;
        }
        this._resolveCompilation = null;
        if( this.compiler.options.suffix === this.getFileExt() ){
            let compilation = await this.compilation.createChildCompilation(this.getResolveFile(), this.compilation.file);
            let jsModule = this.getResolveJSModule();
            if(jsModule && !compilation){
                this.isResolveJsModule = true;
                compilation = jsModule.compilation;
            }else if(jsModule && jsModule.compilation === compilation){
                this.isResolveJsModule = true;
            }
            if( !compilation ){
                this.source.error(1132, this.source.value() );
            }else{
                if(!this.isResolveJsModule){
                    compilation.import = 'importSpecifier';
                }
            }
            return this._resolveCompilation = compilation;
        }else{
            const jsModule = this.getResolveJSModule();
            if(jsModule){
                this.isResolveJsModule = true;
                return this._resolveCompilation = jsModule.compilation;
            }
        }
        return null;
    }

    async createCompleted(){
        const compilation = await this.getResolveCompilationAsync();
        if(compilation){
            await compilation.createCompleted();
            if(this.parentStack.isPackageDeclaration){
                const jsModule = this.getResolveJSModule();
                if(jsModule){
                    const addDesc = (desc, key)=>{
                        if(desc.isClassDeclaration || 
                            desc.isDeclaratorDeclaration ||
                            desc.isInterfaceDeclaration || 
                            desc.isEnumDeclaration || 
                            desc.isStructTableDeclaration)
                        {
                            this.namespace.addDescriptor(key, desc, true);

                        }else if(desc.isNamespaceDeclaration){
                            if(desc.module){
                                const ns = Namespace.create(this.namespace.getChain().concat( desc.value() ).join('.'))
                                desc.module.types.forEach( (desc, key)=>{
                                    ns.addDescriptor(key, desc)
                                });
                                desc.module.descriptors.forEach( (items, key)=>{
                                    items.forEach(item=>ns.addDescriptor(key,item))
                                });
                            }
                        }else{
                            if(desc.isDeclaratorVariable ||  desc.isDeclaratorFunction){
                                if(JSModule.is(desc.module)){
                                    const items = desc.module.descriptors.get(key);
                                    if(items){
                                        items.forEach((value)=>{
                                            if(value.isNamespaceDeclaration){
                                                addDesc(value, key)
                                            }else{
                                                this.namespace.addDescriptor(key, value, true);
                                            }
                                        })
                                        return;
                                    }
                                }
                            }
                            this.namespace.addDescriptor(key, desc);
                        }
                    }

                    if(this.exported){
                        let key = this.exported.value();
                        jsModule.getStacks().forEach( desc=>{
                            this.namespace.addDescriptor(key, desc, true);
                        })
                    }else{
                        jsModule.getAllExportDescriptors().forEach((value, key)=>{
                            if(value.isExportNamedDeclaration){
                                const decl = value.declaration;
                                if(decl){
                                    addDesc(decl, key)
                                }
                            }else {
                                addDesc(value.description(), key)
                            }
                        });
                    }

                    if(this.compilation.isDescriptorDocument()){
                        if(this.exported){
                            let key = this.exported.value();
                            let value = AutoImporter.create(this.source.value(), key, '*');
                            value.origin = this;
                            value.description = this;
                            value.owner = jsModule;
                            this.namespace.imports.set(key, value);
                        }else{
                            let isTop = this.namespace === Namespace.top;
                            jsModule.createImportDescriptors( this.source.value() ).forEach( (value, key)=>{
                                if(isTop && value.extract){
                                    return;
                                }
                                if(value === this)return;
                                if(!this.namespace.imports.has(key)){
                                    value.origin = this;
                                    this.namespace.imports.set(key, value);
                                }
                            });
                        }
                    }
                }
            }
        }
    }

    getFileExt(){
        const resolve = this.getResolveFile();
        if( resolve ){
            const pos = resolve.lastIndexOf('.');
            if(pos>0){
                return resolve.substring(pos);
            }
        }
        return null;
    }
    value(){
        return this.exported ? this.exported.value() : '*';
    }
    raw(){
        return this.exported ? this.exported.raw() : '*';
    }

    getAllDescriptors(exclude=null){
        const exists = this._descriptors;
        if(exists)return exists;
        let properties = null;
        const make = (compilation)=>{
            let properties = new Map();
            let exportDefault = null
            compilation.stack.exports.forEach(stack=>{
                if(stack.isExportDefaultDeclaration){
                    exportDefault = stack.description();
                }else if(stack.isExportNamedDeclaration || stack.isExportAllDeclaration){
                    if(stack !== exclude && stack !== this){
                        const dataset = stack.getAllExportDescriptors(stack)
                        dataset.forEach( (value, key)=>{
                            if(!properties.has(key)){
                                properties.set(key, value);
                            }
                        });
                    } 
                }
            });
            if(exportDefault){
                properties.set('default', exportDefault);
            }
            return properties;
        }

        if(this.isResolveJsModule){
            const jsModule = this.getResolveJSModule();
            properties = jsModule.getAllExportDescriptors();
        }else{
            const compilation = this.getResolveCompilation();
            if(compilation && compilation.stack && compilation.stack.exports.length>0){
                properties = make(compilation)
            }else{
                if(JSModule.is(this.module)){
                    properties = this.module.getAllExportDescriptors();
                }else if(this.compilation.stack.exports.length>0){
                    properties = make(this.compilation)
                }
            }
        }
        return this._descriptors =  properties || new Map()
    }

    getAllExportDescriptors(){
        const exists = this._exportDescriptors;
        if(exists)return exists;
        let properties = null
        if(this.exported){
            properties = new Map([
                [
                    this.exported.value(),
                    this
                ]
            ]);
        }else{
            properties = this.getAllDescriptors();
        }
        this._exportDescriptors = properties;
        return properties;
    }

    description(){
        if(this.source){
            if(this.exported){
                const jsModule = this.getResolveJSModule();
                if(jsModule){
                    return jsModule;
                }
                return this.type()
            }
        }
        return this;
    }

    parser(){ 
        if(super.parser()===false)return false;
        if(this.source){
            const jsModule = this.isResolveJsModule ? this.getResolveJSModule() : null;
            let len = 0;
            if(jsModule){
                len = jsModule.getExportCount();
            }else{
                const compilation = this.getResolveCompilation();
                len = compilation && compilation.stack? compilation.stack.exports.length : 0;
            }
            if(!(len>0)){
                (this.exported || this.source).error(1162, this.source.value());
            }
        }
    }
}

module.exports = ExportAllDeclaration;