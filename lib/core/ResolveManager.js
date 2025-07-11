const path = require("path");
const fs = require("fs");
class ResolveManager{

    #extensions = null;
    #resolveFolders = null;
    #comppiler = null;
    #regexp = null
    #cache = null
    #nodeModuleFolders = null

    constructor(comppiler){
        this.#comppiler = comppiler;
        this.init()
    }

    init(){
        let seg = /[\\|\/]+/;
        let workspaceFolders = this.#comppiler.getWorkspaceFolders();
        let resolveFolders = [
            workspaceFolders,
            workspaceFolders.map(dir=>path.dirname(dir)),
            this.#comppiler.options.resolvePaths
        ].flat().filter(dir=>this.isDir(dir)).map(dir=>path.normalize(dir));
        let extensions = this.#comppiler.options.extensions;
        let nameds = extensions.map(ext=>{
            return ext.startsWith('.') ? ext.substring(1) : ext
        });
        this.#extensions = extensions.map( ext=>ext.startsWith('.') ? ext : '.'+ext);
        this.#regexp = new RegExp(`\\.(${nameds.join('|')})$`)
        this.#resolveFolders = Array.from((new Set(resolveFolders)).values()).sort((a,b)=>{
            let a1 =  a.split(seg).length;
            let b1 =  b.split(seg).length;
            return a1 > b1 ? -1 : a1 < b1 ? 1 : 0;
        });
        this.#cache = Object.create(null);
        this.#cache.resolve = Object.create(null);
        this.#nodeModuleFolders = this.#comppiler.getNodeModuleFolders().map(dir=>path.normalize(dir))
    }

    isDir(dir){
        if(dir && fs.existsSync(dir)){
            return fs.statSync(dir).isDirectory()
        }
        return false
    }

    setCache(key, value, group='resolve'){
        return this.#cache[group][key] = value
    }

    getCache(key,group='resolve'){
        return this.#cache[group][key] || null;
    }

    hasCache(key,group='resolve'){
        return Object.hasOwn(this.#cache[group], key)
    }

    getkey(...args){
        return args.map(arg=>String(arg)).join('-')
    }

    checkExt(file){
        if(!file || typeof file !=='string')return false;
        return this.#regexp.test(file)
    }

    normalizePath( file ){
        if(!file)return file;
        return path.sep === "\\" ? file.replace(/\\/g, "/") : file;
    }

    resolveSource(file, context=null){
        return this.resolve(file, context, false, true, false)
    }

    resolveFile(file, context=null){
        return this.resolve(file, context, false, false, false)
    }

    resovleAssets(file, context=null){
        return this.resolve(file, context, true, false, false)
    }

    resovleDependency(file, context=null){
        return this.resolve(file, context, false, true, true)
    }

    resolve(file, context=null, requireFlag=false, allowDir=true, dependency=true){
        if(typeof file !== "string")return null;
        let key = this.getkey(file, context, requireFlag, allowDir, dependency)
        if(this.hasCache(key)){
            return this.getCache(key);
        }
        if(context && typeof context ==='string' && fs.existsSync(context)){
            if(fs.statSync(context).isFile()){
                context = path.dirname(context);
            }else if(!fs.statSync(context).isDirectory()){
                context = null;
            }
        }else{
            context = null;
        }

        let value = this._resolve(file, context, requireFlag, allowDir)
        if(!value && dependency){
            for(let folder of this.#nodeModuleFolders ){
                value = this._resolveFile(path.join(folder, file), false, true)
                if(value){
                    break;
                }
            }
        }
        if(value){
            value = this.normalizePath(value)
        }
        return this.setCache(key, value)
    }

    _resolveFile(file, addSuffix=false, allowDir=false){
        if(fs.existsSync(file)){
            if(!path.isAbsolute(file)){
                file = path.resolve(file)
            }
            if(allowDir){
                return file;
            }else if(fs.statSync(file).isFile()){
                return file;
            }
        }
        if(addSuffix){
            for(let ext of this.#extensions){
                let result = this._resolveFile(file+ext, false, allowDir) || this._resolveFile(file+'.d'+ext, false, allowDir)
                if(result){
                    return result
                }
            }
        }
        return null
    }

    _resolve(file, context=null, requireFlag=false, allowDir=false){
        let hasSuffix = this.#regexp.test(file);
        if(path.isAbsolute(file)){
            return this._resolveFile(file, !hasSuffix, allowDir)
        }

        if(context){
            let result = this._resolveFile(path.join(context, file), !hasSuffix, allowDir)
            if(result)return result;
        }

        for(let folder of this.#resolveFolders){
            let result = this._resolveFile(path.join(folder, file), !hasSuffix, allowDir)
            if(result)return result;
        }

        if(requireFlag){
            try{
                return require.resolve(file);
            }catch(e){}
        }
        return null
    }

}
module.exports = ResolveManager;