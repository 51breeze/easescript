const fs = require("fs");
const Utils = require("./Utils");
const Compilation = require("./Compilation");
class CompilationGroup extends Compilation{
    constructor(compiler, file){
        super(compiler, file);
        const suffix = String(this.compiler.options.suffix || '.es');
        this.suffix = new RegExp( suffix.replace('.','\\.')+'$','i');
        this.isCompilationGroup = true;
        this._resolveCompilations = null;
        this._resolveFiles = null;
    }
    createAst(){
        throw new TypeError(`Invalid methods for 'createModule'.`);
    }
    createModule(){
        throw new TypeError(`Invalid methods for 'createModule'.`);
    }
    createStack(){
        throw new TypeError(`Invalid methods for 'createStack'.`);
    }
    isValid(){
        return true;
    }
    clear( destroy=false ){
        if( this._resolveCompilations ){
            this._resolveCompilations.forEach( compilation=>compilation.clear(destroy) );
        }
        this._resolveCompilations = null;
        this._resolveFiles = null;
        this._createCompletedFlag = false;
        this._parserAsyncFlag = false;
        this.hasParsed = false;
    }

    resolveFiles(){
        if( this._resolveFiles )return this._resolveFiles;
        const files = this._resolveFiles = [];
        const resolve = (file)=>{
            if(!file)return;
            if( !fs.existsSync(file) )return;
            const stat = fs.statSync(file);
            if( stat.isDirectory() ){
                (Utils.readdir(file, true)||[]).forEach((file)=>{
                    resolve(file);
                });
            }else if( stat.isFile() && this.suffix.test(file) ){
                files.push( file );
            }
        }
        resolve( this.file );
        return files;
    }

    async resolveCompilations(){
        if(this._resolveCompilations)return this._resolveCompilations;
        const compilations = this._resolveCompilations = [];
        const files = this.resolveFiles();
        const results = await Promise.allSettled(files.map(file=>this.compiler.createCompilation(file, this.file, true, false, this)));
        const items = results.map( result=>result.value );
        await Promise.allSettled(items.map(async compilation=>{
            if(compilation){
                compilation.import = this.import;
                Object.assign(compilation.pluginScopes,this.pluginScopes);
                compilation.createStack();
                compilations.push(compilation);
            }
        }));
        return compilations;
    }


    parser(){
        throw new Error('CompilationGroup.parser is deprecated, please use parserAsync.')
    }

    async createCompleted(){
        if(this._createCompletedFlag)return;
        this._createCompletedFlag = true;
        const compilations = await this.resolveCompilations();
        await Promise.allSettled(compilations.map(compilation=>compilation.createCompleted()));
    }

    async parserAsync(){
        if( !this._parserAsyncFlag ){
            this._parserAsyncFlag = true;
            const compilations = await this.resolveCompilations();
            await Promise.allSettled(compilations.map(compilation=>compilation.createCompleted()));
            await Promise.allSettled(compilations.map(compilation=>compilation.parserAsync()));
        }
    }

    checker(){
        if( !this.hasChecked ){
            this.hasChecked = true;
            this.children.forEach( compilation=>compilation.checker() );
        }
    }

    freeze(){
        if( !this.hasFreezed ){
            this.hasFreezed = true;
            this.children.forEach( compilation=>compilation.freeze() )
        }
    }
}

module.exports = CompilationGroup;