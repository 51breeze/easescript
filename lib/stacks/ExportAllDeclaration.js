const Stack = require("../core/Stack");
class ExportAllDeclaration extends Stack {
    constructor(compilation,node,scope,parentNode,parentStack){ 
        super(compilation,node,scope,parentNode,parentStack);
        this.isExportAllDeclaration = true;
        this.source = this.createTokenStack(compilation, node.source, scope, node, this);
        this.exported = this.createTokenStack(compilation, node.exported, scope, node, this);
        if( parentStack && !(parentStack.isProgram || parentStack.isPackageDeclaration || parentStack.isModuleDeclaration) ){
            this.error(1159);
        }
    }

    definition( ctx ){
        const resolveCompilation = this.getResolveCompilation();
        if( resolveCompilation ){
            if(!ctx || ctx.stack === this.source ){
                return {
                    expre:`module "${resolveCompilation.file}"`,
                    location:resolveCompilation.stack.getLocation(),
                    file:resolveCompilation.file,
                    range:this.source.getLocation()
                };
            }else if( !ctx || this.exported === ctx.stack ){
                return {
                    expre:`import ${this.exported.value()}`,
                    location:resolveCompilation.stack.getLocation(),
                    file:resolveCompilation.file,
                    range:this.exported.getLocation()
                };
            }
        }
        return null;
    }

    type(){
        return this.getGlobalTypeById('any');
    }
   
    getResolveFile(){
        if( this.source && this.source.isLiteral ){
            if(this.resolve !== void 0)return this.resolve;
            const resolve = this.resolve = this.compiler.resolve(this.source.value(), this.compilation.file);
            if( !resolve ){
                this.source.error(1122, this.source.value());
            }
            return resolve;
        }
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

    async createCompleted(){
        await this.getResolveCompilationAsync();
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
    parser(){ 
        if(super.parser()===false)return false;
        const resolve = this.getResolveFile();
        if(resolve){
            const compilation = this.getResolveCompilation();
            if(compilation){
                if( !(compilation.stack && compilation.stack.exports.length>0) ){
                    this.source.error(1162, this.source.value());
                }
            }
        }
    }
}

module.exports = ExportAllDeclaration;