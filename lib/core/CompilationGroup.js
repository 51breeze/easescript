const fs = require("fs");
const Utils = require("./Utils");
const Compilation = require("./Compilation");
class CompilationGroup extends Compilation{
    constructor(compiler, file){
        super(compiler, file);
        const suffix = String(this.compiler.options.suffix || '.es');
        this.suffix = new RegExp( suffix.replace('.','\\.')+'$','i');
        this.isCompilationGroup = true;
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
        if( !this.hasParsed ){
            this.hasParsed = true;
            this.children.forEach( compilation=>compilation.clear(destroy) );
        }
    }

    parser(){
        if( !this.hasParsed ){
            this.hasParsed = true;
            const files =  [];
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
            files.forEach( file=>{
                const compilation = this.createChildCompilation(file, this.file, 'compilation-group', true);
                compilation.isMain = this.isMain;
                compilation.import = this.import;
                compilation.parser();
            });
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