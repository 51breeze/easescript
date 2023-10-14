const Compiler = require("../lib/core/Compiler");
const Diagnostic = require("../lib/core/Diagnostic");
const Compilation = require("../lib/core/Compilation");
const path =require("path");
class Creator {
    constructor(options){
        const compiler = new Compiler(Object.assign({
            debug:false,
            diagnose:true,
            output:path.join(__dirname,"./build"),
            workspace:path.join(__dirname,"./src"),
            parser:{
                locations:true
            }
        },options || {}));
        compiler.initialize();
        compiler.loadTypes([
            path.join(__dirname,"index.d.es")
        ],{scope:'local',inherits:[]});
        this._compiler = compiler;
    }

    get compiler(){
        return this._compiler;
    }

    removeError(errors, code, line, kind=0){
        const index = errors.findIndex( item=>{
            return item.code===code && item.kind === kind && (item.range.start.line) === line;
        });
        if( index>= 0 ){
            return errors.splice(index,1)[0];
        }
        return null;
    }

    factor(file,source){
        return new Promise((resolved,reject)=>{
            const compiler = this.compiler;
            const compilation = new Compilation( compiler );
            
            try{
                if( file ){
                    file = compiler.getFileAbsolute(file)
                }else{
                    compilation.file = 'source.es'; 
                }
                compilation.pluginScopes.scope = 'local';
                compilation.file = file;
                compilation.parser(source);
                
                if(compilation.stack){
                    resolved(compilation);
                }else{
                    reject({compilation,errors:compiler.errors});
                }
            }catch(error){
                console.log(error)
                reject({compilation,errors:[error]});
            }
        });
    }

    startBySource(source){
        return this.factor(null, source);
    }

    startByFile(file){
        return this.factor(file);
    }
}

exports.Diagnostic = Diagnostic;
exports.Creator=Creator;