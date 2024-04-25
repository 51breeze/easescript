const Stack = require("../core/Stack");
class ImportDeclaration extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isImportDeclaration= true;
        this.source = this.createTokenStack( compilation, node.source, scope, node, this );
        this.specifiers = node.specifiers.map( item=>this.createTokenStack( compilation, item, scope, node, this ) );
        this.alias = this.createTokenStack( compilation, node.alias, scope, node,this );
        this.importedModule = null;
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

    definition(ctx){
        if(ctx && (ctx.stack === this.source||ctx===this.source) ){
            const compilation = this.getResolveCompilation();
            if( compilation ){
                return {
                    expre:`(import) "${compilation.file}"`,
                    location:compilation.stack.getLocation(),
                    range:this.source.getLocation(),
                    file:compilation.file
                };
            }else{
                return {
                    expre:`(import) "${this.source.value()}"`,
                    location:this.source.getLocation(),
                    range:this.source.getLocation(),
                };
            }
        }
        return null;
    }

    description(){
        if( this.source.isLiteral ){
            const compilation = this._resolveCompilation;
            if(compilation && compilation.modules.size > 0){
                return compilation.mainModule;
            }
            return null;
        }else {
            return this.getModuleById(this.source.value()) || null;
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
        const resolve = this.resolve = this.compiler.resolve(
            this.source.isLiteral ? this.source.value() : this.source.value().replace('.', '/'), 
            this.compilation.file
        );
        if( !resolve ){
            return this.source.value();
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

    async getResolveCompilationAsync(){
        if(this._resolveCompilation !== void 0){
            return this._resolveCompilation;
        }
        this._resolveCompilation = null;
        if( this.compiler.options.suffix === this.getFileExt() ){
            const compilation = this._resolveCompilation = await this.compilation.createChildCompilation(this.getResolveFile(), this.compilation.file);
            if( !compilation ){
                this.source.error(1132, this.source.value() );
            }else{
                compilation.import = 'importSpecifier';
            }
            return compilation;
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
            const resolveCompilation = this.getResolveCompilation();
            this.specifiers.forEach(item=>item.parser());
            if(resolveCompilation){
                const desc = this.description();
                if( !(resolveCompilation.stack && resolveCompilation.stack.exports.length>0) && !desc){
                    this.source.error(1162, this.source.value());
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
        return this.importedModule || this.description() || this.getGlobalTypeById('any');
    }

    value(){
        return this.source.value();
    }
    
    raw(){
        return this.source.raw();
    }
}

module.exports = ImportDeclaration;
