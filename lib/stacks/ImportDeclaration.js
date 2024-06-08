const Context = require("../core/Context");
const JSModule = require("../core/JSModule");
const Module = require("../core/Module");
const Namespace = require("../core/Namespace");
const Stack = require("../core/Stack");
class ImportDeclaration extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isImportDeclaration= true;
        this.source = this.createTokenStack( compilation, node.source, scope, node, this );
        this.specifiers = node.specifiers.map( item=>this.createTokenStack( compilation, item, scope, node, this ) );
        this.alias = this.createTokenStack( compilation, node.alias, scope, node,this );
        this.importedModule = null;
        this.isResolveJsModule = false;
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
        if(this.source.isLiteral && ctx.stack === this.source){
            const com = this.getResolveCompilation();
            const file = com ? com.file : this.getResolveFile();
            const location = com ? com.stack.getLocation() : void 0;
            return {
                expre:`import "${file}"`,
                location,
                file:file ? file : void 0,
                range:this.source.getLocation()
            };
        }
        const desc = this.description();
        if(!desc)return null;
        const source = this.alias || (this.source.isMemberExpression ? this.source.property : this.source);
        const kind = Module.is(desc) ? desc.getModuleKind()+' ' : ''
        const ops = {onlyTypeName:!Context.is(ctx)};
        const head = ctx.stack === this.alias ? '(import alias)' : 'import'
        return {
            expre:`${head} ${kind}${desc.type().toString(ctx,ops)}`,
            location:source.getLocation(),
            file:this.file
        };
    }

    toDefinition(ctx={}){
        if(this.source.isLiteral && ctx.stack === this.source){
            const com = this.getResolveCompilation();
            const file = com ? com.file : this.getResolveFile();
            const location = com ? com.stack.getLocation() : void 0;
            return {
                expre:`import "${file}"`,
                location,
                file:file ? file : void 0,
                range:this.source.getLocation()
            };
        }
        const desc = this.description();
        if(!desc)return null;
        const ops = {onlyTypeName:!Context.is(ctx)};
        if(Module.is(desc)){
            const kind = desc.getModuleKind()+' ';
            const head = ctx.stack === this.alias ? '(import alias)' : 'import';
            const expre = `${head} ${kind}${desc.toString(ctx,ops)}`;
            return desc.getStacks().map( stack=>{
                return {
                    expre,
                    location:(stack.id || stack.key).getLocation(),
                    file:stack.file,
                }
            });
        }
        return {
            expre:`import ${desc.type().toString(ctx,ops)}`,
            location:desc.getLocation?.(),
            file:desc.file
        };
    }

    description(){
        if(this.source.isLiteral){
            return null;
        }else {
            return this.importedModule || this.getModuleById(this.source.value()) || null;
        }
    }

    async addImport( owner, scope ){

        if( this.source.isLiteral ){
            await this.getResolveCompilationAsync();
        }else{
            await this.loadTypeAsync(this.source.value());
        }
      
        const desc = this.description();
        if( desc ){
            scope = scope || this.scope;
            const nameId = this.alias ? this.alias.value() : 
                            desc.isType ? desc.id : 
                            this.source.isMemberExpression ? this.source.property.value() : 
                            this.source.value();
              
            if( desc.isModule ){
                const add = (key, module, stack)=>{
                    if(owner){
                        owner.addImport(key, module, module.id != key, scope)
                    }
                    scope.define(key, this);
                    const moduleStack = module.moduleStack;
                    if( moduleStack ){
                        moduleStack.addUseRef(stack);
                    }

                    this.importedModule = module;
                    if( !this.compilation.importModules.has(key) ){
                        this.compilation.importModules.set(key, module)
                    }else{
                        const old = this.compilation.importModules.get(key)
                        if(old.additional === this.additional){
                            stack.error(1025,key);
                        }
                    }
                }
                if( this.source.isLiteral ){
                    const compilation = this.getResolveCompilation();
                    const isAll = this.specifiers.some( item=>item.isImportNamespaceSpecifier );
                    if( isAll ){
                        compilation.modules.forEach( (module,index)=>{
                            add(compilation.mainModule === module ? nameId : module.id, module, this)
                        });
                    }else{
                        this.specifiers.forEach( item=>{
                            if( item.isImportDefaultSpecifier ){
                                add(item.local.value(), desc, item);
                            }else{
                                const module = compilation.modules.get( item.imported.value() );
                                if( module ){
                                    add(item.value(), module, item);
                                }
                            }
                        });
                    }
                }else{
                    add( nameId, desc, this);
                }
            }else{
                this.importedModule = desc;
                scope.define(nameId, desc);
            }

        }else if(!this.source.isLiteral){
            this.error(1026, this.source.value());
        }else{
            this.specifiers.forEach(item=>{
                item.localBinding();
            });
        }
        return desc;
    }

    getResolveFile(){
        if(this.resolve !== void 0)return this.resolve;
        let source = this.source.isLiteral ? this.source.value() : this.source.value().replace('.', '/');
        let resolve = this.resolve = this.compiler.resolve(
            source, 
            this.compilation.file
        );
        if(!resolve && this.source.isLiteral){
            const describeSuffix = this.compiler.options.describeSuffix;
            if(describeSuffix && !source.endsWith(describeSuffix)){
                const at = this.file.lastIndexOf('/')
                const basename = this.file.slice(at+1);
                if(basename === source + describeSuffix){
                    return resolve;
                }
                resolve = this.compiler.resolve(
                    source + describeSuffix, 
                    this.compilation.file
                );
                if(resolve && resolve !== this.file){
                    return this.resolve = resolve;
                }
            }
            return this.resolve = this.source.value();
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
            let source = this.source.value()
            if(source.includes('/')){
                source = source.slice(source.lastIndexOf('/')+1)
            }
            const describeSuffix = this.compiler.options.describeSuffix;
            if(describeSuffix && source.endsWith(describeSuffix)){
                source = source.substring(0, source.length - describeSuffix.length)
            }
            return JSModule.getModule(source, this.getResolveFile());
        }
        return null;
    }

    async getResolveCompilationAsync(){
        if(this._resolveCompilation !== void 0){
            return this._resolveCompilation;
        }
        this._resolveCompilation = null;
        if( this.compiler.options.suffix === this.getFileExt() ){
            let compilation = await this.compilation.createChildCompilation(this.getResolveFile(), this.compilation.file);
            const jsModule = this.getResolveJSModule();
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
            if(this.source.isLiteral){
                const jsModule = this.getResolveJSModule();
                if(jsModule){
                    this.isResolveJsModule = true;
                    return this._resolveCompilation = jsModule.compilation;
                }
            }
        }
        return null;
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
            this.specifiers.forEach(item=>item.parser());
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
        return this.importedModule || this.description() || Namespace.globals.get('any');
    }

    value(){
        return this.source.value();
    }
    
    raw(){
        return this.source.raw();
    }
}

module.exports = ImportDeclaration;
