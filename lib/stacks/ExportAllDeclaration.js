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
                (this.exported||this).error(1195, key, this.namespace.toString()|| 'global')
            }else{
                _exports.set(key, this)
            }
        }
    }

    definition(ctx){
        if(this.source){
            let file = this.getResolveFile();
            let source = file || this.source.value();
            let compi = this.getResolveCompilation();
            let location = compi ? compi.stack.getLocation() : null;
            let selection = this.source.getLocation();
            const def = {
                text:`(import) "${source}"`,
                location,
                selection,
                file
            };
            if(ctx && ctx.hoverStack === this.source ){
                let jsModule = this.getResolveJSModule();
                if(jsModule){
                    return jsModule.definition(ctx)
                }
            }else if(ctx && this.exported === ctx.hoverStack){
                def.selection = this.exported.getLocation();
                def.text = `(exported) ${this.exported.value()}`;
                let jsModule = this.getResolveJSModule();
                if(jsModule){
                    return jsModule.definition(ctx);
                }
            }
            return def;
        }
    }

    hover(ctx){
        if(this.source){
            let file = this.getResolveFile();
            let source = file || this.source.value();
            const def = {
                text:`(import) "${source}"`,
                selection:this.source.getLocation()
            };   
            if(ctx && ctx.hoverStack === this.source){
               return def;
            }else if(ctx && this.exported === ctx.hoverStack){
                def.text = `(exported) ${this.exported.value()}`;
                def.selection = this.exported.getLocation();
                let jsModule = this.getResolveJSModule();
                if(jsModule){
                    return jsModule.hover(ctx)
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
        return this.getAttribute('getResolveFile',()=>{
            if( this.source && this.source.isLiteral ){
                const source = this.source.value();
                let resolve = this.compiler.resolveDescriptorFile(source, this.compilation.file);
                if(!resolve){
                    resolve =this.compiler.resolveManager.resolveFile(source, this.compilation.file);
                    if(resolve && resolve === this.file){
                        resolve = null
                    }
                }
                resolve = resolve || source;
                if( !resolve && !JSModule.get(source)){
                    this.source.error(1122, source);
                }
                return resolve;
            }
            return null;
        })
    }

    getResolveCompilation(){
        return this.getAttributeAlways('resolveCompilation');
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
                    module = JSModule.getModule(source, resolve);
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
        if(!this.source)return null;
        if(this.hasAttributeAlways('resolveCompilation')){
            return this.getAttributeAlways('resolveCompilation')
        }
       
        let source = this.source.value();
        if(this.compiler.manifester.hasResource(source)){
            await this.compilation.loadManifest(source, null, true);
        }

        let hasResolve = this.compiler.checkFileExt(this.getResolveFile())
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
                compilation = jsModule.compilation;
            }
        }else if(compilation){
            compilation.import = 'importSpecifier';
        }
        
        if(hasResolve && !compilation){
            this.source.error(1132, source);
        }
        if(compilation && !this.compilation.isDescriptorDocument()){
            compilation.once('onRemoved',()=>{
                this.removeAttributeAlways('resolveCompilation')
                this.removeAttributeAlways('getResolveJSModule')
                this.isResolveJsModule = false;
                this.compiler.printLogInfo(`onRemoved: ${this.toString()}: getResolveCompilationAsync: ${compilation.file}`, 'Stack')
            }) 
        }
        this.setAttributeAlways('resolveCompilation', compilation)
        return compilation;
    }

    async createCompleted(){
        const compilation = await this.getResolveCompilationAsync();
        if(compilation){
            await compilation.createCompleted();
            if(this.parentStack.isPackageDeclaration){
                const jsModule = this.getResolveJSModule();
                if(jsModule){
                    const isDefault = (owner, desc)=>{
                        if(owner){
                            if(owner.id === desc.value()){
                                return true;
                            }
                            const assignment = owner.exports.get('*');
                            if(assignment && assignment.isExportAssignmentDeclaration && assignment.expression.isIdentifier){
                                if(assignment.expression.value() === desc.value()){
                                    return true;
                                }
                            }
                        }
                        return false;
                    }

                    const addDesc = (desc, key, isChild=false)=>{
                        const owner = !isChild && desc.parentStack && desc.parentStack.isModuleDeclaration && desc.parentStack.parentStack.isProgram ? desc.parentStack.module : null;
                        if(desc.isClassDeclaration || 
                            desc.isDeclaratorDeclaration ||
                            desc.isInterfaceDeclaration || 
                            desc.isEnumDeclaration || 
                            desc.isDeclaratorTypeAlias ||
                            desc.isStructTableDeclaration)
                        {
                            if(isDefault(owner, desc)){
                                return ;
                            }
                            this.namespace.addDescriptor(key, desc, true);

                        }else if(desc.isNamespaceDeclaration){
                            if(desc.module){
                                const ns = owner && desc.module.id === owner.id ? this.namespace : Namespace.create(this.namespace.getChain().concat(desc.module.namespace.getChain()).join('.'))
                                desc.module.descriptors.forEach( (items, key)=>{
                                    items.forEach(item=>{
                                        if(this.isModuleDefinitionStack(item) || item.isDeclaratorTypeAlias){
                                            ns.addDescriptor(key,item, true)
                                        }
                                    })
                                });
                            }
                        }else{
                            if(desc.isDeclaratorVariable ||  desc.isDeclaratorFunction){
                                if(isDefault(owner, desc)){
                                    return ;
                                }
                                if(JSModule.is(desc.module)){
                                    const items = desc.module.descriptors.get(key);
                                    if(items){
                                        items.forEach((value)=>{
                                            if(value.isNamespaceDeclaration){
                                                addDesc(value, key, true)
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
                                const decl = value.description();
                                if(decl){
                                    addDesc(decl, key)
                                }
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