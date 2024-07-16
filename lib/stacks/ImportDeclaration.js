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

    definition(ctx={}){
        const source = this.alias || (this.source.isMemberExpression ? this.source.property : this.source);
        const file = source.isLiteral ? `"${source.value()}"` : source.value();
        const def = {
            text:`import ${file}`,
            location:source.getLocation(),
            range:source.getLocation(),
            file:this.file
        }
        if(this.source.isLiteral && ctx.stack === this.source){
            const com = this.getResolveCompilation();
            const file = com ? com.file : this.getResolveFile();
            const location = com && com.stack? com.stack.getLocation() : {
                start:{
                    line:1,
                    column:0
                },
                end:{
                    line:1,
                    column:0
                },
            };
            
            let desc = this.getResolveJSModule();
            if(desc){
                let result = desc.getStacks().map(stack=>{
                    const d = stack.definition(ctx);
                    d.range = def.range;
                    return d;
                });
                return result;
            }
            
            return {
                expre:`import "${file}"`,
                location,
                file,
                range:this.source.getLocation()
            };
        }
        let desc = this.description();
        if(desc){
            return this.definitionMergeToArray(desc.definition(ctx), def)
        }else{
            return def;
        }
    }

    toDefinition(ctx={}){
        return this.definition(ctx);
    }

    description(){
        return this.importDescriptor;
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
            let result = await this.loadTypeAsync(this.source.value());
            let property = this.source.isMemberExpression ? this.source.property.value() : this.source.value();
            let ns =  this.source.isMemberExpression ? Namespace.fetch(this.source.object.value(), null, true) : Namespace.top;
            let nameId = this.alias ? this.alias.value() : property;
            if(result){
                this.importDescriptor = result;
            }
            check(nameId, this)
            scope.define(nameId, this);
            this.compilation.hookAsync('compilation.create.done', ()=>{
                if(!result){
                    this.importDescriptor = result = this.getImportMatchDescriptor(ns, property) || ns.get(property);
                }
                if(result && Utils.isTypeModule(result)){
                    add(nameId, result, this)
                }
                if(!this.compilation.isDescriptorDocument() && ns.imports.has(property)){
                    this.hasImporterDescriptor = true;
                    this._hasMatchAutoImporter = true;
                    this.addImportSpecifierDependency(ns.imports.get(property), this, nameId)
                }
            });
        }
    }

    getResolveFile(){
        if(this.resolve !== void 0)return this.resolve;
        let source = this.source.isLiteral ? this.source.value() : this.source.value().replace('.', '/');
        let resolve = this.resolve = this.compiler.resolve(
            source, 
            this.compilation.file
        );
        if(!resolve && this.source.isLiteral){
            return this.resolve = this.compiler.resolveDescriptorFile(source, this.compilation.file) || this.source.value();
        }
        return resolve;
    }

    checkFileExists(){
        this.getResolveFile();
        if(!this.resolve){
            this.source.error(1122, this.source.value());
            return false;
        }
        return true;
    }

    getResolveCompilation(){
        return this._resolveCompilation;
    }

    getResolveJSModule(){
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
    }

    async getResolveCompilationAsync(){
        if(this._resolveCompilation !== void 0){
            return this._resolveCompilation;
        }
        this._resolveCompilation = null;

        let source = this.source.value();
        if(this.compiler.manifester.hasResource(source, true)){
            await this.compilation.loadManifest(source, null, true);
        }

        let hasResolve = this.compiler.options.suffix === this.getFileExt();
        let compilation = null;
        if( hasResolve ){
            compilation = await this.compilation.createChildCompilation(this.getResolveFile(), this.compilation.file);
            if(compilation !== this.compilation){
                this._resolveCompilation = compilation;
            }
        }
        
        const jsModule = this.getResolveJSModule();
        if(jsModule){
            this.isResolveJsModule = true;
            if(!compilation){
                this._resolveCompilation = compilation = jsModule.compilation;
            }
        }else if(compilation){
            compilation.import = 'importSpecifier';
        }
        
        if(hasResolve && !compilation){
            this.source.error(1132, source);
        }

        return compilation;
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

    getDescByName(desc, key){
        if( !desc || desc.isAnyType )return null;
        if( (desc.isAliasType || desc.isLiteralObjectType) && !desc.isModule ){
            if( desc.isAliasType )desc = desc.inherit;
            if( desc.isLiteralObjectType ){
                return desc.attribute( key );
            }
        }else if( desc.isNamespace ){
            return  desc.get( key );
        }
        return null;
    }

    parser(){
        if(super.parser()===false)return false;
        if( this.source.isLiteral ){
            if(this.specifiers.length>0){
                const compilation = this.getResolveCompilation();
                if(compilation){
                    const jsModule = this.isResolveJsModule ? this.getResolveJSModule() : null;
                    let len = 0;
                    if(jsModule){
                        len = jsModule.getExportCount();
                    }else if(compilation.stack){
                        len = compilation.stack.exports.length;
                    }
                    if(!(len>0)){
                        this.error(1162, this.source.value());
                    }
                }
                this.specifiers.forEach(item=>item.parser());
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
        return this.importDescriptor || this.description() || Namespace.globals.get('any');
    }

    value(){
        return this.source.value();
    }
}

module.exports = ImportDeclaration;
