const Compiler = require("../lib/core/Compiler");
const Diagnostic = require("../lib/core/Diagnostic");
const Compilation = require("../lib/core/Compilation");
const path =require("path");
const _compiler = new Compiler(Object.assign({
    debug:false,
    throwParseError:true,
    lang:'en-US',
    diagnose:true,
    enableComments:true,
    output:path.join(__dirname,"./build"),
    workspace:path.join(__dirname,"./src"),
    parser:{
        locations:true
    }
},{}));


//  const fs = require("fs");
//  const _compilation = new Compilation(_compiler)

// _compilation.parseAst( fs.readFileSync(path.join(__dirname, 'src/test/Component.es')).toString() )


//_compilation.parseAst(`` )





let initialize = false;
async function ready(){
    if( !initialize ){
        initialize = true;
        await _compiler.initialize();
        await _compiler.loadTypes([
            path.join(__dirname,"index.d.es")
        ],{scope:'local',inherits:[]});
    }
}

// ready();
// return;

class Creator {
    constructor(){
        this._compiler = _compiler;
    }

    get compiler(){
        return this._compiler;
    }

    removeError(errors, code, line, kind=0){
        const index = errors.findIndex( item=>{
            return item.code===code && item.kind === kind && (item.range.start.line) === line;
        });
        if( index>= 0 ){
            const res = errors.splice(index,1)[0];
            this.removeError(errors, code, line, kind);
            return res;
        }
        return null;
    }

    factor(file,source){
        return new Promise( async(resolved,reject)=>{
            await ready();
            const compiler = this.compiler;
            const compilation = file ? await compiler.createCompilation(compiler.getFileAbsolute(file)) : new Compilation(compiler);
            try{
                compilation.pluginScopes.scope = 'local';
                await compilation.parserAsync(source);
                if(!file){
                    compilation.file = 'source.es'; 
                }
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