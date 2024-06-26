const JSModule = require("../core/JSModule");
const Namespace = require("../core/Namespace");
const Stack = require("../core/Stack");
class ExportNamedDeclaration extends Stack {
    constructor(compilation,node,scope,parentNode,parentStack){ 
        super(compilation,node,scope,parentNode,parentStack);
        this.isExportNamedDeclaration = true;
        this.declaration = this.createTokenStack(compilation, node.declaration, scope, node, this);
        this.source = this.createTokenStack(compilation, node.source, scope, node, this);
        this.specifiers = node.specifiers ? node.specifiers.map( item=>this.createTokenStack(compilation, item, scope, node, this) ) : [];
        if( parentStack && !(parentStack.isProgram || parentStack.isPackageDeclaration || parentStack.isModuleDeclaration) ){
            this.error(1159);
        }
        let _exprots = null;
        if(this.parentStack.isModuleDeclaration){
            if(this.declaration){
                const decl = this.declaration;
                const _module = this.parentStack.module;
                if(decl.isDeclaratorFunction || decl.isDeclaratorVariable || decl.isNamespaceDeclaration){
                    _module.addDescriptor(decl.value(), decl);
                    if(decl.isNamespaceDeclaration){
                        _module.namespaces.set(decl.value(), decl.module)
                    }
                }else if(decl.isDeclaratorDeclaration || 
                    decl.isDeclaratorTypeAlias || 
                    decl.isClassDeclaration || 
                    decl.isInterfaceDeclaration || 
                    decl.isStructTableDeclaration || 
                    decl.isEnumDeclaration || 
                    decl.isTypeStatement){
                    _module.setType(decl.value(), decl);
                }
                _exprots = _module.exports;
            }
        }else if(this.compilation.isDescriptorDocument()){
            _exprots = this.namespace.exports;
        }

        if(this.declaration && _exprots){
            const decl = this.declaration;
            if(decl.isVariableDeclaration || decl.isDeclaratorVariable){
                decl.declarations.forEach( decl=>{
                    let key = decl.id.value();
                    if(_exprots.has(key)){
                        decl.id.error(1195, key, this.namespace.toString())
                    }else{
                        _exprots.set(key, this)
                    }
                });
                return;
            }
            let key = null;
            if(decl.isNamespaceDeclaration){
                key=decl.id.value();
            }else if(decl.isDeclaratorDeclaration || decl.isInterfaceDeclaration || decl.isClassDeclaration){
                key=decl.module.id;
            }else if(decl.isDeclaratorTypeAlias){
                key=decl.left.value()
            }else if( decl.isDeclaratorFunction || decl.isFunctionDeclaration){
                key=decl.key.value()
            }else if( decl.isAssignmentExpression ){
                key=decl.left.value()
            }else if(decl.isIdentifier || decl.isLiteral){
                key=decl.value()
            }
            if(key){
                _exprots.set(key, this)
            }
        }
    }

    definition(ctx={}){
        if(ctx.stack === this.source){
            let jsModule = this.parentStack.getResolveJSModule();
            if(jsModule){
                return jsModule.definition(ctx)
            }
            let location =this.source.getLocation();
            let file = this.file;
            return {
                text:`import "${this.source.value()}"`,
                location,
                file,
                range:location
            };
        }
        if(this.declaration){
            return this.declaration.definition( ctx );
        }
        return null;
    }

    freeze(){
        super.freeze();
        this.declaration && this.declaration.freeze();
        this.source && this.source.freeze();
        this.specifiers.forEach( item=>item.freeze() );
    }

    getKeyName(){
        if( this.declaration ){
            if( this.declaration.isClassDeclaration ){
               return this.declaration.module.id;
            }else if( this.declaration.isFunctionDeclaration ){
               return local === item.declaration.key.value() ? item.declaration : null;
            }else if( this.declaration.isAssignmentExpression ){
               return local === item.declaration.left.value() ? item.declaration : null;
            }else if( this.declaration.isIdentifier ){
               return local === item.declaration.value() ? item.declaration : null;
            }else if( this.declaration.isVariableDeclaration ){
               const result = item.declaration.declarations.find( decl=>decl.id.value() === local );
               return result ? result : null;
            }
        }
    }

    getAllExportDescriptors(exclude=null){
        const exists = this._descriptors;
        if(exists)return exists;
        const properties = new Map();
        const anyType = Namespace.globals.get('any');
        this._descriptors = properties;
        if( this.declaration ){
            const decl = this.declaration;
            if(decl.isNamespaceDeclaration){
                properties.set(decl.id.value(), decl.module)
            }else if(decl.isDeclaratorDeclaration || decl.isInterfaceDeclaration || decl.isClassDeclaration){
                properties.set(decl.module.id, decl.module)
            }else if( decl.isDeclaratorTypeAlias ){
                properties.set(decl.left.value(), decl.type())
            }else if( decl.isDeclaratorFunction || decl.isFunctionDeclaration){
                properties.set(decl.key.value(), decl)
            }else if( decl.isAssignmentExpression ){
               properties.set(decl.left.value(), decl.right.description() || anyType )
            }else if( decl.isIdentifier || decl.isLiteral){
                properties.set(decl.value(), decl.description() || anyType )
            }else if( decl.isVariableDeclaration || decl.isDeclaratorVariable ){
                decl.declarations.forEach( decl=>{
                    const desc = decl.init ? decl.init.description() : decl.id.description()
                    properties.set(decl.id.value(), desc || anyType)
                });
            }
        }else if( this.specifiers && this.specifiers.length > 0 ){
            this.specifiers.forEach( specifier=>{
                const desc = specifier.description() || anyType;
                if(desc.isExportAllDeclaration){
                    if(desc !== exclude){
                        desc.getAllExportDescriptors(exclude).forEach((value,key)=>{
                            properties.set(key, value)
                        })
                    }
                }else{
                    properties.set(specifier.exported.value(),desc)
                }
            });
        }
        return properties;
    }

    getDescByName( name ){
        if( this.declaration ){
            const decl = this.declaration;
            if( decl.isClassDeclaration ){
               return decl.module.id === name ? decl.module : null;
            }else if( decl.isFunctionDeclaration ){
               return name === decl.key.value() ? decl : null;
            }else if( decl.isAssignmentExpression ){
               return name === decl.left.value() ? decl.right.description() : null;
            }else if( decl.isIdentifier ){
               return name === decl.value() ? decl.description() : null;
            }else if( decl.isVariableDeclaration ){
               const result = decl.declarations.find( de=>de.id.value() === name );
               return result ? result.description() : null;
            }
        }else if( this.specifiers && this.specifiers.length > 0 ){
            const result = this.specifiers.find( specifier=>{
                return specifier.exported.value() === name 
            });
            if( result ){
               return result.description();
            }
        }
    }

    getResolveFile(){
        if( this.source && this.source.isLiteral ){
            if(this.resolve !== void 0)return this.resolve;
            const source = this.source.value();
            let resolve = this.resolve = this.compiler.resolve(source, this.compilation.file);
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
        if(this._resolveCompilation !== void 0)return this._resolveCompilation;
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
        }
        if(this.declaration){
            await this.declaration.createCompleted();
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

    description(){
        const decl = this.declaration;
        if(decl){
            if( decl.isAssignmentExpression ){
                return decl.right.description();
            }else if( decl.isVariableDeclaration || decl.isDeclaratorVariable){
                if(decl.declarations.length === 1){
                    const de = decl.declarations[0];
                    return de.init ? de.init.description() : de.id.description();
                }
            }
        }
        return decl;
    }

    descriptor(){
        const decl = this.declaration;
        if(decl){
            if(decl.isNamespaceDeclaration){
                return decl.module
            }else if(decl.isClassDeclaration || 
                decl.isNamespaceDeclaration || 
                decl.isDeclaratorDeclaration || 
                decl.isInterfaceDeclaration ||  
                decl.isStructTableDeclaration || 
                decl.isDeclaratorTypeAlias || 
                decl.isTypeStatement ||
                decl.isEnumDeclaration){
                return decl.type()
            }
        }
        const desc = this.description();
        if(this.is(desc))return desc.descriptor();
        return desc;
    }

    type(){
        const decl = this.declaration;
        if(decl){
            return decl.type();
        }
        return Namespace.globals.get('any');
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
                len = compilation && compilation.stack ? compilation.stack.exports.length : 0;
            }
            if( !(len>0) ){
                this.error(1162, this.source.value());
            }
        }

        if(this.declaration){
            this.declaration.parser();
            this.declaration.setRefBeUsed();
            const desc = this.description();
            if(desc){
                const decl = this.declaration;
                if( decl.isAssignmentExpression ){
                    decl.right.setRefBeUsed(desc);
                }else if( decl.isVariableDeclaration ){
                    decl.declarations.forEach( decl=>{
                        const desc = decl.init ? decl.init.description() : decl.id.description()
                        if(decl.init){
                            decl.init.setRefBeUsed(desc);
                        }else{
                            decl.id.setRefBeUsed(desc);
                        }
                    });
                }
            }
        }
        this.specifiers.forEach((item)=>item.parser());
    }
}

module.exports = ExportNamedDeclaration;