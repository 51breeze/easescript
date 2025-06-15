const Compilation  = require("./Compilation");
const CompilationGroup  = require("./CompilationGroup");
const mergeWith  = require("lodash/mergeWith");
const path   = require("path");
const cwd    = process.cwd();
const fs = require("fs");
const chokidar = require("chokidar");
const Utils = require("./Utils");
const Lang = require("./Lang");
const Manifester = require("./Manifester");
const dirname = __dirname;
const compilations = new Map();
const EventDispatcher = require("./EventDispatcher.js");
const Diagnostic  = require("./Diagnostic.js");
const Namespace = require("./Namespace"); 
const Cache = require("./Cache"); 
const ScopeManager = require("./ScopeManager"); 
const ResolveManager = require("./ResolveManager"); 
const Logger = require("./Logger"); 
const pluginInterfaces=[
    {name:'name', type:['string']},
    {name:'platform', type:['string']},
    {name:'version', type:['string','number']},
    {name:'start', type:['function']},
    {name:'build', type:['function']},
    {name:'getGeneratedCodeByFile', type:['function']},
    {name:'getGeneratedSourceMapByFile', type:['function']},
    {name:'getTokenNode', type:['function']},
];
const SharedInstances = [];
const globalCompilations = new Set();
const cacheHandle = {
    pkg:Cache.group('pkg'),
    create:Cache.group('create'),
    load:Cache.group('load'),
    folder:Cache.group('folder'),
    appoint:Cache.group('appoint'),
    common:Cache.group('common')
};
function merge(...args){
   return mergeWith(...args,(objValue, srcValue)=>{
        if(Array.isArray(objValue) && Array.isArray(srcValue)){
            if(srcValue[0]===null)return srcValue.slice(1);
            srcValue.forEach( value=>{
                if( !objValue.includes(value) ){
                    objValue.push(value)
                }
            })
            return objValue;
        }
   });
}

function defaultOptions(){
    return {
        throwError:false,
        debug:false,
        logger:{
            enable:false,
            outFile:true,
            outDir:'.es-client-log',
            outServiceDir:'.es-service-log',
            threshold:60,
            service:false,
            formatDate:true,
            limitSize:1024 * 1024 * 2
        },
        diagnose:true,
        workspace:'src',
        service:false,
        enableStackMap:false,
        enableComments:false,
        lang:'zh-CN',
        watch:false,
        suffix:'.es',
        plugins:[],
        types:[],
        scanFolders:[],
        cwd,
        scopes:[],
        metadata:{
            http:{
                responseField:null
            }
        },
        literalObjectStrict:false,
        freeze:false,
        watchFolders:[],
        watchOptions:{
            persistent: true,
            ignoreInitial:true,
            ignored:/(^|[\/\\])\../,
            depth:0
        },
        esc:null,
        annotations:[
            'Provider','Callable','Runtime','Syntax','Env','Router','Post','Get','Delete','Put','Option','Deprecated','Define','Internal','Alias',
            'Override','Dynamic','Embed','SkinClass','Abstract','WebComponent','HostComponent','Require','Required','Import','Main','Reference',
            'DOMAttribute','Injector','Reactive','Hook','URL','Http','Version','Removed','Noop','Bindding'
        ],
        jsx:{
            componentClass:'web.components.Component',
            skinClass:'web.components.Skin',
            slot:{
                'scopeName':'scope',
                'scopeValue':'scope',
            },
            xmlns:{
                sections:{
                    '@directives':['if','elseif','else','for','each','show','custom'],
                    '@events':['*'],
                    '@natives':['*'],
                    '@slots':['*'],
                    '@binding':['*'],
                },
                context:['for','each'],
                default:{
                    'e':'@events',
                    's':'@slots',
                    'd':'@directives',
                    'b':'@binding',
                    'n':'@natives',
                    'u':'web.ui',
                    'on':'@events',
                    'slot':'@slots',
                    'bind':'@binding',
                    'native':'@natives',
                    'directive':'@directives',
                    'ui':'web.ui',
                }
            }
        },
        metaStatementMethods:['Runtime','Syntax','Env','Version'],
        excludeDescribeFile:[],
        require:{},
        commandLineEntrance:false,
        loadGlobalDescribeFile:true,
        scanTypings:true,
        autoLoadDescribeFile:true,
        describePattern:/(\.d\.es)$/,
        describeSuffix:'.d.es',
        resolvePaths:[],
        references:[],
        extensions:['.es','.ease'],
        configFileName:'es.config',
        configFileExtensions:['.json','.js','.mjs','.cjs'],
        manifestFileName:'typings.json',
        globalTypes:[path.resolve(dirname,'../typing')],
        fileQueryParamFieldMap:{
            'id':'id',
            'type':'type',
            'file':'file',
        },
        resourceQueryOrder:[
            {test:/^file\./, order:-1}
        ],
        parser:{
            sourceType:'module',
            locations:false,
            preserveParens:true,
            ecmaVersion:12,
            reserved:['global'],
        },
        checker:{
            effect:true,
            references:{
                exactly:true,
                noNullable:true
            }
        }
    }
}

let __compiler=null;

class Compiler extends EventDispatcher{

    static is(value){
        return value ? value instanceof Compiler : false;
    }

    static getCompilations(){
        return compilations;
    }

    static getCompilers(){
        return SharedInstances;
    }

    static compiler(){
        return __compiler || (__compiler=new Compiler());
    }

    constructor(options={}){
        super(); 
        this.rawOptions = options;
        this.compilations = compilations;
        this.globals = globalCompilations;
        this.main = [];
        this.regexpSuffix = /\.[a-zA-Z]+$/
        this.filesystem = new Map();
        this.grammar  = new Map();
        this.errors=[];
        this.utils = Utils;
        this.restartuping = false;
        this.configFileRecords = null;
        this.resolveConfigFile = null;
        this.diagnostic = Diagnostic;
        this.pluginInstances = [];
        this.watchers = [];
        this.disconnected = false;
        this.initQueues = [];
        this.parseOptions(options);
        this.scopeManager=new ScopeManager(this);
        this.manifester = new Manifester(this);
        this.resolveManager = new ResolveManager(this);
        this.logger = new Logger(this);
        SharedInstances.push(this);
        process.on('exit', () => {
            this.dispose();
        });
    }

    isDescriptorFile(file){
        if(!file || typeof file !== 'string')return false;
        const describePattern = this.options.describePattern || /(\.d\.es)$/;
        return describePattern.test(file)
    }

    isExtensionFile(file){
        return this.extensionRegexp.test(String(file))
    }

    isExtensionName(ext){
        let _ext = String(ext)
        return this.options.extensions.some( ext=>{
            if(_ext===ext)return true;
            let name = _ext.startsWith('.') ? _ext.substring(1) : _ext;
            return ext.startsWith('.') ? ext.substring(1) === name : name === ext;
        })
    }

    checkFileExt(file){
        if(!file)return false;
        return this.isExtensionFile(file)
    }
    
    clearAddDirFileCache(file){
        Cache.each((key, cache)=>{
            if(cache.name==='global'){
                return;
            }
            key = String(key).toLowerCase();
            if(key.includes(file)){
                cache.clear(key);
            }
        });
    }

    addWatch(){
        let fsWatcher = this.fsWatcher;
        if(!fsWatcher){
            fsWatcher = this.createWatcher(merge({},
                this.options.watchOptions,
                {depth:0}
            ));
            if(!fsWatcher){
                throw new Error('Watcher create failed.')
            }else{
                this.fsWatcher = fsWatcher;
            }
        }

        let watchFolders = [];
        let timeoutId = null;
        let workspacePaths = this.getWorkspaceFolders();
        if(Array.isArray(this.options.watchFolders)){
            watchFolders.push(...this.options.watchFolders);
        }

        const cache = {};
        const resolvePath=(dir,wfs)=>{
            return path.isAbsolute(dir) ? dir : this.resolveManager.resolveSource(dir, wfs.options?.cwd);
        }
        const addDirs = [];
        const addDir = (wfs)=>(dir=>{
            if(dir){
                if(cache[dir])return;
                cache[dir] = true;
                dir = resolvePath(dir, wfs);
                const key = this.normalizePath(dir).toLowerCase();
                this.clearAddDirFileCache(key);
                if(key.includes('/node_modules/')){
                    addDirs.push(dir);
                    if(timeoutId){
                        clearTimeout(timeoutId)
                    }
                    timeoutId = setTimeout(()=>{
                        timeoutId = null;
                        const dirs = addDirs.splice(0,addDirs.length);
                        this.scanTypings(dirs, false).then( async dataset=>{
                            const result = await this.doLoadPluginTypes(dataset);
                            if(result && Array.isArray(result) && result.length > 0){
                                this.dispatcher('onAddDirCompilationDone', result.flat(), true);
                                this.printLogInfo(`addDirOrFiles: ${result.flat().join('\n')}`, 'watcher')
                            }
                        });
                    }, 2000)
                }
            }
        });

        const unlinkDir = (wfs)=>(dir=>{
            if(dir){
                delete cache[dir];
                dir = resolvePath(dir, wfs);
                dir = this.normalizePath(dir).toLowerCase();
                const removed = [];
                let check = false;
                this.compilations.forEach( compilation=>{
                    if(String(compilation.file).toLowerCase().includes(dir)){
                        if(!check){
                            check = compilation.isDescriptorDocument();
                        }
                        this.removeCompilation(compilation, true);
                        removed.push(compilation)
                    }
                });
                if(removed.length>0){
                    this.dispatcher('onUnlinkDirCompilationDone',removed,check);
                    this.printLogInfo(`unlinkDir: ${removed.join('\n')}`, 'watcher')
                }
            }
        });

        fsWatcher.on('unlink',(file)=>{
            file = resolvePath(file, fsWatcher);
            this.printLogInfo(`unlink: ${file}`, 'watcher')
            const compi = this.removeCompilation(file, true);
            if(compi){
                this.dispatcher('onUnlinkCompilationDone', compi);
            }else{
                this.printLogInfo(`unlink: ${file} (remove compilation is null)`, 'watcher')
            }
        });

        // fsWatcher.on('add',(file)=>{
        //     file = resolvePath(file, fsWatcher);
        //     if(this.checkFileExt(file)){
        //         this.createCompilation(file).then( async compi=>{
        //             if(compi){
        //                 await compi.ready();
        //                 this.dispatcher('onAddCompilationDone', compi);
        //             }else{
        //                 this.printLogInfo(`createCompilation: ${file} (null)`, 'watcher')
        //             }
        //         })
        //         this.printLogInfo(`add: ${file}`, 'watcher')
        //     }
        // })

        if(watchFolders.length>0){
            watchFolders = Array.from((new Set(watchFolders.map(dir=>{
                if(!path.isAbsolute(dir) && !dir.includes('*')){
                    dir = path.join(process.cwd(),dir)
                }
                return this.normalizePath(dir);
            }))).values());
            fsWatcher.add(watchFolders.filter(folder=>!workspacePaths.some(src=>folder.includes(src))))
            .on('addDir',addDir(fsWatcher))
            .on('unlinkDir',unlinkDir(fsWatcher));
        }

        const wfs = this.createWatcher(null,20);
        const addCompilations = new Map();
        workspacePaths.forEach(folder=>{
            wfs.add(folder)
        });
        wfs.on('addDir',addDir(wfs))
        .on('unlinkDir',unlinkDir(wfs))
        .on('add',(file)=>{
            file = resolvePath(file, wfs);
            if(this.checkFileExt(file)){
                this.printLogInfo(`add: ${file}`, 'watcher')
                this.createCompilation(file).then( async compi=>{
                    if(compi){
                        addCompilations.set(file, compi)
                        await compi.ready();
                        this.dispatcher('onAddCompilationDone', compi);
                    }else{
                        this.printLogInfo(`createCompilation: ${file} (null)`, 'watcher')
                    }
                })
            }
        }).on('change', async (file)=>{
            file = resolvePath(file, wfs);
            let compi = this.getCompilation(file);
            if(compi){
                if(!compi.isDestroyed){
                    await compi.ready();
                }
            }
        });
    
        let file = this.resolveConfigFile;
        if(file){
            let timerId = null;
            file = this.normalizePath(file);
            fsWatcher.add(file).on('change',(changed)=>{
                changed = this.normalizePath(resolvePath(changed, fsWatcher));
                if(file !== changed){
                    return;
                }

                if(timerId){
                    clearTimeout(timerId);
                }
                this.printLogInfo(`configFileChange -> ${changed}`, 'watcher')
                timerId = setTimeout(()=>{
                    if(!this.disconnected ){
                        this.onConfigFileChanged(file);
                    }
                    timerId = null;
                },1000);
            });
        }
    }
    
    createWatcher(options, depth=0){
        options = options || {
            persistent: true,
            ignoreInitial:true,
            ignored:/(^|[\/\\])\../,
            depth:depth
        }
        const wfs = new chokidar.FSWatcher(options);
        this.watchers.push(wfs);
        return wfs;
    }

    dispose(){
        this.disconnected = true;
        this.watchers.forEach(wfs=>{
            wfs.close();
        });
        this.watchers.length = 0;
    }

    callUtils(name, ...args){
        const fun = Utils[name];
        return fun ? fun.apply(Utils, args) : false;
    }

    printLogInfo(info, group=''){
        this.logger.print(info, group);
    }

    markMemoryUsage(key){
        this.logger.mark(key);
    }

    getMemoryUsage(key){
        return this.logger.getMemoryUsage(key);
    }

    getTotalMemoryUsage(){
        return this.logger.getTotalMemoryUsage();
    }

    getEscOptions(options={}){
        const loaders = {};
        const loaderConfig = {
            text:['.html','.xml','.txt','.svg','.svgz'],
            json:['.json'],
            file:['.eot','.ttf','.woff','.woff2'],
            js:['.js','.mjs','.cjs'],
            css:['.css','.less','.sass','.scss'],
            dataurl:['.png','.gif','.jpeg','.jpg','.bmp','.webp'],
        }
        Object.keys(loaderConfig).forEach((name)=>{
            const extensions = loaderConfig[name];
            extensions.forEach( ext=>{
                loaders[ext] = name;
            });
        });

        const base64Suffixes = {};
        ['.gif','.png','.jpg','.jpeg','.bmp'].forEach( key=>{
            base64Suffixes[key] = true;
        });

        return merge({
            watch:false,
            treeShaking:true,
            assets:{
                base64Suffixes,
                base64Callback:(file, extname=null)=>{
                    if(file){
                        const suffixes = this.options.esc.assets.base64Suffixes || {};
                        return !!suffixes[(extname || path.extname(file)).toLowerCase()];
                    }
                    return false
                }
            },
            resolve:{
                alias:{},
                extensions:['.es','.mjs','.cjs','.js','.jsx'],
                paths:[]
            },
            styles:{
                preprocess:{},
            },
            loaders,
            typingOptions:{
                dirname:'types',
                byFile:true
            },
            define:{},
            splitting:false
        }, options);
    }

    parseConfigFile(options={}){
        if(!options.configFileName || !options.configFileExtensions)return options;
        const name = options.configFileName;
        const extensions = options.configFileExtensions || [];
        const file = extensions.concat(path.join(options.cwd, name)).map(ext=>path.join(options.cwd, name+ext)).find( file=>fs.existsSync(file));
        if(!file)return options;
        const data = this.loadConfigFile(file);
        if(data){
            return merge(options, data);
        }
        return options;
    }

    parseOptions(rawOptions={}){
        let options = this.parseConfigFile(merge(defaultOptions(),rawOptions));
        let cwd = options.cwd;
        
        if( !fs.existsSync(cwd) ){
            cwd = process.cwd();
            Utils.error(`options.cwd dirname is not exists.`)
        }

        if( options.output ){
            options.output = this.pathAbsolute( options.output )
        }else{
            options.output = path.resolve(cwd,'build');
        }

        Lang.setLangId(String(options.lang).toLowerCase() === 'zh-cn' ? 0 : 1);

        options.workspace = path.isAbsolute(options.workspace) ? options.workspace : path.resolve(cwd, options.workspace);
        
        if( !fs.existsSync(options.workspace) ){
            if(options.workspace !== 'src'){
                let resolvePath = path.join(cwd, 'src');
                if(fs.existsSync(resolvePath)){
                    options.workspace = resolvePath;
                }else{
                    options.workspace = cwd;
                }
            }else{
                options.workspace = cwd;
            }
        }

        if( !fs.existsSync(options.workspace)  ){
            Utils.error( `options.workspace dirname is not exists.`);
        }
        
        options.workspace = this.normalizePath(options.workspace);

        if(options.service){
            options.enableComments = true;
        }else{
            options.esc = this.getEscOptions(options.esc)
        }

        this.options = options;
        this.suffix = options.suffix;
        this.workspace = options.workspace;
        let extensions = this.options.extensions.map(ext=>{
            return ext.startsWith('.') ? ext.substring(1) : ext
        })
        this.extensionRegexp = new RegExp(`\\.(${extensions.join('|')})($|\\?)`)
        return options;
    }

    setWorkspace(dist){
       this.workspace = this.normalizePath( path.isAbsolute(dist) ? dist : path.resolve(this.options.cwd || cwd, dist) );
       this.options.workspace = this.workspace;
       return this;
    }

    getWorkspaceFolder(context,name,depth=1){
        const exclude = ['node_modules'];
        const files = (Utils.readdir(context)||[]).map( file=>{
            return file.charCodeAt(0) !== 46 && !exclude.includes(file) && fs.statSync( path.join(context,file) ).isDirectory();
        });
        const absolutes = files.map( file=>path.join(context,file) );
        var i=0;
        for(;i<absolutes.length;i++){
            const dirname = path.join(absolutes[i], name);
            if( fs.existsSync(dirname) ){
                return dirname;
            }
        }
        if( depth < 3 ){
            i=0;
            for(i=0;i<absolutes.length;i++){
                const dirname = this.getWorkspaceFolder(absolutes[i], name, depth++);
                if( dirname ){
                    return dirname;
                }
            }
        }
        return null;
    }

    getWorkspaceFolders(){
        if(cacheHandle.common.has('getWorkspaceFolders')){
            return cacheHandle.common.get('getWorkspaceFolders')
        }
        let references = this.options.references || [];
        let result = this.workspace ? [this.workspace] : []
        if(references.length>0){
            let workspace = this.options.workspace || 'src';
            let cwd = this.options.cwd;
            if(path.isAbsolute(workspace)){
                workspace = path.basename(workspace)
            }
            let _result = references.map(name=>{
                const folder = path.join(cwd, name, workspace)
                if(fs.existsSync(folder)){
                    return this.normalizePath(folder)
                }
                return null
            }).filter(Boolean);
            if(_result.length>0){
                result = _result;
            }
        }
        cacheHandle.common.set('getWorkspaceFolders', result)
        return result;
    }

    getNodeModuleFolders(){
        if(cacheHandle.common.has('getNodeModuleFolders')){
            return cacheHandle.common.get('getNodeModuleFolders')
        }
        let references = this.options.references || [];
        let cwd = this.options.cwd;
        let result =[this.options.cwd, ...references].map( dir=>{
            if(!path.isAbsolute(dir)){
                dir = path.join(cwd, dir, 'node_modules')
            }else{
                dir = path.join(dir, 'node_modules')
            }
            return fs.existsSync(dir) ? this.normalizePath(dir) : null
        }).filter(Boolean);
        let value = Array.from(new Set(result).values())
        cacheHandle.common.set('getNodeModuleFolders', value)
        return value;
    }

    async restartup(){
        const time = Date.now();
        this.restartuping = true;
        this.dispatcher('onRestartupBefore');
        this.printLogInfo(`restartup before`, 'compiler')
        await this.clear();
        this.logger.init(this);
        this.watchers.forEach(wfs=>{
            wfs.close();
        });
        if(this.options.service || this.options.watch){
            this.addWatch();
        }
        await this.__loadGlobalTypes();
        await this.__loadPluginTypes();
        this.restartuping = false;
        this.printLogInfo(`restartup after (${Date.now()-time} ms)`, 'compiler')
        this.dispatcher('onRestartupAfter');
    }

    async clear(){
        Namespace.clearAll();
        Cache.clearAll();
        this.errors.splice(0, this.errors.length);
        this.manifester.clear();
        this.scopeManager.reset();
        this.compilations.forEach(compi=>{
            compi.destory();
        });
        this.compilations.clear();
        this.globals.clear();
    }

    compareChanged(oldValue, newValue){
        const hasOwn = Object.prototype.hasOwnProperty;
        const compare = (oldValue, newValue)=>{
            const oldType = Array.isArray(oldValue) ? 'array' : typeof oldValue;
            const newType = Array.isArray(newValue) ? 'array' : typeof newValue;
            if(oldValue && oldType ==='object'){
                if(newType !== 'object')return true;
                return Object.keys(oldValue).some( key=>{
                    if(!hasOwn.call(newValue,key))return true;
                    return compare(oldValue[key], newValue[key]);
                });
            }else if(oldValue && oldType ==='array'){
                if(newType !== 'array')return true;
                if(oldValue.length !== newValue.length)return true;
                const _oldValue = oldValue.slice(0).sort();
                const _newValue = newValue.slice(0).sort();
                return _oldValue.some( old=>{
                    return !_newValue.some( value=>!compare(old, value));
                });
            }else{
                if(newType !== oldType)return true;
                if(newType==='function'){
                    return false
                }
                return String(oldValue) != String(newValue);
            }
        }
        return compare(oldValue, newValue);
    }

    onConfigFileChanged(file){
        const records = this.configFileRecords;
        const oldSource = records.source;
        const newSource = fs.readFileSync(file,{encoding:'utf-8'}).toString();
        if(oldSource===newSource)return;
        if(oldSource.replace(/[\r\n\s\t]+/g,'')===newSource.replace(/[\r\n\s\t]+/g,''))return;
        records.source = newSource;
        records.prevent = false;
        this.dispatcher('onConfigChangeBefore', records);
        if(!records.prevent){
            this.parseOptions(this.rawOptions);
            this.dispatcher('onConfigChanged');
            this.restartup();
        }
    }

    loadConfigFile(file){
        try{
            const records = this.configFileRecords;
            const id = require.resolve(file);
            delete require.cache[id];
            const config = require(id);
            let data = config ==='function' ? config(this) : config;
            this.resolveConfigFile = file;
            if( Object.prototype.toString.call(data) !== '[object Object]' ){
                data = {};
                console.error(`config file export data type can only is object. in '${file}'`);
            }
            if(records){
                records.data = data;
            }else{
                const source = fs.readFileSync(file,{encoding:'utf-8'}).toString();
                this.configFileRecords = {
                    file,
                    data,
                    source
                };
            }
            return data;
        }catch(e){
            console.error(`${e.message} in '${file}'`);
            return null;
        }
    }

    getOutputFileSystem(syntax){
        if(this.options.service)return;
        // const key = `${syntax}-output`;
        // if( this.filesystem.has(key) ){
        //     return this.filesystem.get(key);
        // }
        // const name = "memory-fs";
        // const MemoryFileSystem = require(name);
        // const filesystem =  new MemoryFileSystem();
        // this.filesystem.set(key, filesystem);
        // return filesystem;
        return {};
    }

    getInputFileSystem(){
        if(this.options.service)return;
        // const key = `input`;
        // if( this.filesystem.has(key) ){
        //     return this.filesystem.get(key);
        // }
        // const name = "memory-fs";
        // const MemoryFileSystem = require(name);
        // const filesystem =  new MemoryFileSystem();
        // this.filesystem.set(key, filesystem);
        // return filesystem;
        return {}
    }

    resolve(file, context){
        let isLocal = file.charCodeAt(0) === 64;
        if( isLocal )file = file.substr(1);
        if( isLocal ){
            // file = this.getFileAbsolute(file, context);
            // if( fs.existsSync(file) ){
            //     return file;
            // }

            file = this.resolveManager.resolve(file, context);
            if(file){
                file = this.normalizePath( file );
            }
            return null;
        }
        // const load = (file, options )=>{
        //     try{ 
        //         return require.resolve(file, options);
        //     }catch{}
        //     return null;
        // }
        // const _file = file;
        // file = this.getFileAbsolute(file, context);
        // if( !fs.existsSync(file) ){
        //     file = load(_file, {
        //         paths:[context].concat(
        //             this.options.cwd,
        //             this.options.resolvePaths
        //         )
        //     });
        //     if(_file === file){
        //         return null;
        //     }
        // }

        file = this.resolveManager.resolve(file, context, true);
        if( file ){
            file = this.normalizePath( file );
        }
        return file;
    }

    normalizeModuleFile(moduleOrCompilation, id, type, resolveFile, attrs=null ){
        const file = this.normalizePath( moduleOrCompilation.file );
        const isModule = moduleOrCompilation.isModule && moduleOrCompilation.isType;
        if( moduleOrCompilation.require && isModule ){
            return file;
        }
        const segments = [];
        const compilation = isModule ? moduleOrCompilation.compilation : moduleOrCompilation;
        if( !id && isModule && compilation.modules && compilation.modules.size > 1){
            if( compilation.isDescriptorDocument() ){
                id = moduleOrCompilation.getName();
            }else{
                const modules = Array.from(compilation.modules.values()).filter(module=>!module.isDeclaratorModule);
                if( modules.length > 1 ){
                    id = moduleOrCompilation.getName();
                }
            }
        }

        const map = this.options.fileQueryParamFieldMap || {};
        if(attrs && typeof attrs ==='object'){
            const excludes = {id,type,file:resolveFile};
            Object.keys(attrs).forEach( key=>{
                if(excludes[key])return;
                if(attrs[key]){
                    segments.push(`${key}=${attrs[key]}`);
                }else{
                    segments.push(key);
                }
            });
        }

        if( id )segments.push(`${map.id||'id'}=${id}`);
        if( type )segments.push(`${map.type||'type'}=${type}`);
        segments.sort((a,b)=>{
            if(!a.includes('=') && b.includes('='))return -1;
            if(!b.includes('=') && a.includes('='))return 1;
            return a.localeCompare(b);
        });
        if( resolveFile )segments.push(`${map.file||'file'}=${resolveFile}`);
        return segments.length > 0 ? `${file}?${segments.join('&')}` : file;
    }

    resolveExtFormat(file, extformat){
        if(typeof extformat === "string"){
            let info = path.parse(file);
            let extname = extformat.replace("{extname}", info.ext);
            return Utils.normalizePath(path.join(info.dir, info.name + extname))
        }else{
            throw new Error("Invalid extformat. must is string type");
        }
    }

    parseResourceId(module, query={}, extformat=null){
        const isModule =Utils.isTypeModule(module);
        const compilation = isModule ? module.compilation : module;
        let file = Utils.normalizePath( module.file );
        if(!compilation || !file){
            throw new Error('Invalid module or compilation')
        }
        
        if(extformat){
            file = this.resolveExtFormat(file, extformat);
        }

        if( !query.id && isModule && compilation.modules && compilation.modules.size > 1){
            if(compilation.mainModule !== module){
                query.id = module.getName();
            }
        }

        const segments = [];
        const orderMaps = {};
        const orders = this.options.resourceQueryOrder || [];

        Object.keys(query).forEach( key=>{
            let value = key
            if(query[key] != null && query[key]!==true){
                const val = String(query[key]).trim();
                if(val){
                    value=`${key}=${val}`;
                }
            }
            let res = orders.find(item=>item.test.test(value));
            orderMaps[value] = res ? res.order : 0;
            segments.push(value);
        });

        const len = segments.length;
        if(len>1){
            segments.sort((a,b)=>{
                let aa = orderMaps[a];
                let bb = orderMaps[b];
                if(aa<0)aa = len + aa;
                if(bb<0)bb = len + bb;
                if(aa>bb)return 1;
                if(aa<bb)return -1;
                if(!a.includes('='))return -1;
                return a.localeCompare(b);
            });
        }
       
        return segments.length > 0 ? `${file}?${segments.join('&')}` : file;
    }


    normalizePath( file ){
        if(!file)return file;
        if(file.includes('\\')){
            return path.sep === "\\" ? file.replace(/\\/g, "/") : file;
        }
        return file;
    }

    getFileAbsolute(file, context, flagSuffix = true, checkNodeModules=true){
        // if( typeof file !== "string" )return null;
        // if( flagSuffix && !this.regexpSuffix.test( file ) ){
        //     file =file+this.suffix;
        // }
        // if( path.isAbsolute( file )){
        //     file = path.resolve(file);
        // }else{
        //     if(context){
        //         context = context.replace(/\\/g,'/');
        //         const resolve=(root, name)=>{
        //             let file = path.join(root,name)
        //             if(fs.existsSync(file))return file;
        //             if( checkNodeModules ){
        //                 file = path.join(root,'node_modules',name);
        //                 if(fs.existsSync(file))return file;
        //             }
        //             return null;
        //         };
        //         const section = context.split('/');
        //         let root = context;
        //         let name = file;
        //         while( root && !(file = resolve(root,name) ) && section.pop() ){
        //             root = section.join("/");
        //         }
        //     }else{
        //         file = path.resolve(this.workspace,file);
        //     }
        // }
        return this.resolveManager.resolveSource(file, context);
        // if(file){
        //     return this.normalizePath(file);
        // }
        // return null;
    }

    resolveDescriptorFile(source, context){
        const describeSuffix = this.options.describeSuffix;
        if(describeSuffix && !source.endsWith(describeSuffix)){
            if(context){
                const at = context.lastIndexOf('/')
                const basename = context.slice(at+1);
                if(basename === source + describeSuffix){
                    return null
                }
            }
            return this.resolveManager.resolveFile(
                source + describeSuffix, 
                context
            );
        }
        return this.resolveManager.resolveFile(source, context);
    }

    getRelativeWorkspace( file ){
        if(file){
            file = this.normalizePath( file );
            const folders = this.getWorkspaceFolders()
            for(let folder of folders){
                if( file.includes(folder) ){
                    return path.relative(folder, file);
                }
            }
        }
        return null;
    }

    getFileNamespace(file){
        file = this.resolveManager.resolveFile(file);
        if(file){
            file = this.getRelativeWorkspace(file);
            if(file){
                return path.dirname(file).split( /[\\\/]+/ ).join('.')
            }
        }
        return null
    }

    getFileClassName(file, isFull=false){
        file = this.resolveManager.resolveFile(file);
        if(file){
            if(isFull){
                let paths = this.getRelativeWorkspace(file);
                if(paths){
                    const dirname = path.dirname(paths)
                    const basename = path.basename(paths)
                    const index = basename.indexOf('.');
                    const name = basename.substring(0, index);
                    return [...dirname.split( /[\\\/]+/ ), name].join('.')
                }
            }else{
                file = path.basename(file);
                const index = file.indexOf('.')
                return file.substring(0, index)
            }
        }
        return null
    }

    resolveFiles(folder, depth=-1){
        const files = [];
        const resolve = (file, existed=false, index=0)=>{
            if(existed || (file && fs.existsSync(file))){
                const stat = fs.statSync(file);
                if(stat.isDirectory()){
                    if(depth < 0 || depth > index){
                        (Utils.readdir(file, true)||[]).forEach((file)=>{
                            resolve(file, true, index+1);
                        });
                    }
                }else if(stat.isFile()){
                    files.push(file);
                }
            }
            return files;
        }
        return resolve(folder);
    }

    getRelativeWorkspacePath(file, flag=false){
        const folders = this.getWorkspaceFolders();
        let value = null;
        if(folders.length===1){
            value = Utils.normalizePath(path.relative(folders[0],file))
        }else{
            value = folders.map(folder=>path.relative(folder,file)).filter((a, b)=>{
                let a1 = a.startsWith('..') ? 1 : 0
                let b1 = b.startsWith('..') ? 1 : 0
                if(a1>0){
                    a1 = a.split('..').length
                }
                if(b1>0){
                    b1 = b.split('..').length
                }
                return a1 - b1;
            })[0];
        }
        if(flag && value && value.includes('..')){
            return null;
        }
        return Utils.normalizePath(value || file);
    }

    resolveRuleFiles(rulePath, ignoreCase=true){
        if(rulePath.includes('*')){
            const segs = rulePath.split(/[\\\/]+/);
            const filter = (files, prefix)=>{
                if(files.length>0){
                    const parttern = segs.map( rule=>{
                        if(rule==='*')return '(\\w+)'
                        if(rule==='**')return '(.+?)'
                        if(rule.startsWith('*'))return rule.replaceAll('*', '(\\w+)');
                        return rule
                    });
                    if(prefix)parttern.unshift('('+prefix.join('|')+')') ;
                    const rule = new RegExp( parttern.join('[\\\\\\/]'), ignoreCase ? 'i' : '')
                    return files.filter(file=>rule.test(file))
                }
                return files
            }
            if(rulePath.startsWith('*')){
                const folders = this.getWorkspaceFolders()
                return filter(folders.map(folder=>{
                    return this.resolveFiles(folder)
                }).flat(), folders.map(folder=>path.basename(folder)));
            }else{
                const index = segs.findIndex(item=>item=='*' || item=='**')
                const ends = (segs.length-1) === index;
                if(ends){
                    const resolveFile = this.resolveManager.resolveSource(path.dirname(rulePath));
                    if(resolveFile){
                        return this.resolveFiles(resolveFile, rulePath.endsWith('**') ? -1 : 1)
                    }
                }else{
                    const baseDir = this.resolveManager.resolveSource(segs.slice(0, index).join('/'))
                    if(baseDir){
                        return filter(this.resolveFiles(baseDir));
                    }
                }
            }
        }else{
            const baseDir = this.resolveManager.resolveSource(path.dirname(rulePath));
            if(baseDir){
                const basename = path.basename(rulePath);
                const files = this.resolveFiles(baseDir, 1)
                return files.filter(file=>{
                    return path.basename(file).startsWith(basename)
                });
            }
        }
        return []
    }

    pathAbsolute(file){
        return this.normalizePath(path.isAbsolute( file ) ? path.resolve(file) : path.resolve(cwd,file));
    }

    removeCompilation(file, flag=false){
        if(!file)return false;
        let compilation = file;
        let rawFile = file;
        let id = null;
        if(typeof file ==='string'){
            if(flag){
                file = this.normalizePath(file)
            }else{
                file = this.resolveManager.resolveSource(file)
            }
            if(file){
                id = this.getResourceId(file);
                compilation = this.compilations.get(id);
            }
        }

        this.printLogInfo(`removeCompilation: ${rawFile} result:${Utils.isCompilation(compilation)}`, 'compiler')

        if(Utils.isCompilation(compilation)){
            this.dispatcher('onRemoveCompilationBefore',compilation);
            compilation.dispatcher('onRemoved');
            if(id==null){
                id = this.getResourceId(compilation.file);
            }
            if(id){
                this.compilations.delete(id);
            }
            compilation.isDestroyed = true;
            compilation.clear();
            return compilation;
        }
        return false;
    }

    getResourceId(resourcePath){
        resourcePath = String(this.normalizePath(resourcePath)).toLowerCase();
        if(resourcePath.includes('/node_modules/')){
            return resourcePath.split('/node_modules/').pop();
        }else{
            return resourcePath;
        }
    }

    getCompilation(file,context){
        file = this.resolveManager.resolveSource(file, context)
        if(file){
            return this.getCompilationByFile(file)
        }
        return null;
    }

    getCompilationByFile(file){
        const resourceId = this.getResourceId(file)
        return this.compilations.get(resourceId) || null;
    }

    hasCompilation(file,context){
        file = this.resolveManager.resolveSource(file, context)
        if(file){
            const resourceId = this.getResourceId(file)
            return this.compilations.has( resourceId );
        }
        return false;
    }
    
    async createCompilation(file, context=null, flag=false, isRoot=false, parentCompilation=null){
        const originFile = file;
        file = this.resolveManager.resolveSource(file, context)
        if(file){
            const resourceId = this.getResourceId(file)
            if( this.compilations.has(resourceId) ){
                return this.compilations.get(resourceId);
            }
            const isGroup = isRoot ? fs.statSync(file).isDirectory() : false;
            const compilation = isGroup ? new CompilationGroup(this, file) : new Compilation(this, file);
            this.compilations.set(resourceId, compilation);
            compilation.originFile = originFile;
            if(!file.includes('/node_modules/')){
                const inWorkspace = this.getWorkspaceFolders().some(ws=>file.includes('/'+path.basename(ws)+'/'))
                if(inWorkspace){
                    compilation.pluginScopes.scope='local';
                    compilation.pluginScopes.inherits = [];
                }
                if(this.options.service || this.options.watch){
                    if( this.fsWatcher ){
                        this.fsWatcher.add(file);
                    }
                }
            }

            if(!flag && !isGroup && this.options.autoLoadDescribeFile && !compilation.isDescriptionType){
                await this.loadDescriptorFiles( path.dirname(file) );
            }

            if( parentCompilation ){
                compilation.parent = parentCompilation;
                parentCompilation.children.push(compilation);
            }

            this.dispatcher('onCreatedCompilation',compilation);
            return compilation;
            
        }
        return null;
    }

    async loadDescriptorFiles( dirname ){
        const descFile = this.resolveAppointFile('index','index.d.es',dirname);
        if(!cacheHandle.load.records(descFile)){
            await this.loadTypes([descFile], {scope:'local', inherits:[]});
        }else if(!descFile){
            const file = this.resolveAppointFile('package','package.json', dirname);
            if( file ){
                const data = this.resolveTypingsFromPackage(file);
                if( data && data.size>0 ){
                    await Promise.allSettled(Array.from(data.values()).map(this.loadTypes(item.files, item.esconfig)))
                }
            }
        }
    }

    readFolderTypings(data, file, context, esconfig, scopeFile, isRoot=false){
        file = path.isAbsolute(file) ? file : path.join(context, file);
        file = this.normalizePath(file);
        if(cacheHandle.folder.records(file) || !fs.existsSync(file))return;
        const stat = fs.statSync( file );
        if( stat.isDirectory() ){
            const result = Utils.readdir(file);
            if(result){
                result.forEach(name=>{
                    this.readFolderTypings(data, path.join(file,name), file, esconfig, scopeFile, false);
                });
            }
        }else if( stat.isFile() && (this.isDescriptorFile(file) || isRoot && file.endsWith(this.suffix))){
            let dataset = data.get(scopeFile);
            if( !dataset ){
                dataset = {
                    esconfig,
                    context,
                    files:[file]
                }
                data.set(scopeFile,dataset);
            }else{
                dataset.files.push(file);
            }
        }
    }

    normalizePkgTypings(value){
        if(value){
            if( typeof value ==='string' ){
                return value.split(',').map( item=>item.trim() );
            }else if( Array.isArray(value) ){
                return value.map( item=>item.trim() );
            }
        }
        return [];
    }

    resolveTypingsFromPackage(jsonFile, dataset=null, typings=null){
        if(cacheHandle.pkg.records(jsonFile)){
            return null;
        }
        if(!fs.existsSync(jsonFile))return null;
        this.printLogInfo(`resolve-types: ${jsonFile}`,'compiler')
        dataset = dataset || new Map();
        const pkg = require(jsonFile);
        const folder = path.dirname(jsonFile);
        let pkgName = String(pkg.name||'').trim();
        if(pkgName.includes('/')){
            pkgName = pkgName.split('/').pop();
        }
        let esconfig = pkg.esconfig || {
            inherits:[],
            scope:pkgName
        }

        if( esconfig.typings && Array.isArray(esconfig.typings) ){
            esconfig.typings.forEach( file=>{
                this.readFolderTypings(dataset, file, folder, esconfig, jsonFile, true);
            });
        }

        const _typings = typings || this.normalizePkgTypings(pkg.typings);
        if( _typings ){
            if( !esconfig.scope ){
                esconfig.scope = pkgName;
            }
            _typings.forEach( file=>{
                file = path.isAbsolute(file) ? file : path.join(folder, file);
                if(/\.json$/.test(file) && fs.existsSync(file)){
                    try{
                        this.manifester.add(require(file), path.dirname(file));
                    }catch(e){
                        throw e;
                    }
                }else{
                    this.readFolderTypings(dataset, file, folder, esconfig, jsonFile, true);
                }
            });
        }
        return dataset;
    }

    resolveAppointFile(prefix, filename, folder, entry=null, prevs=[], ctx=null){
        if(!folder)return null;
        if(!fs.existsSync(folder))return null;

        folder = this.normalizePath(folder);
        entry = entry || folder;
        const key = prefix+':'+folder;

        const value = cacheHandle.appoint.get(key);
        if( value !== void 0 ){
            return value;
        }

        if( ctx === null ){
            ctx = this.normalizePath(path.normalize(this.options.cwd || process.cwd()));
        }

        if( !folder.includes(ctx) ){
            return null;
        }

        prevs.push(folder);
        let file = this.normalizePath(path.join(folder, filename));
        if( fs.existsSync(file) ){
            this.printLogInfo(`resolve-types: ${file}[${prefix}] from ${entry} (yes)`,'compiler')
            prevs.forEach( folder=>{
                const key = prefix+':'+folder;
                cacheHandle.appoint.set(key, file);
            });
            return file;
        }else{
            this.printLogInfo(`resolve-types: ${file}[${prefix}] from ${entry} (no)`,'compiler')
            const result = this.resolveAppointFile(prefix, filename, path.dirname(folder), entry, prevs, ctx);
            if(!result && entry===folder){
                prevs.forEach( folder=>{
                    const key = prefix+':'+folder;
                    cacheHandle.appoint.set(key, null);
                });
            }
            return result;
        }
    }

    async scanTypings(folders, scanDependencyFlag = true, dataset=null){
        if( !Array.isArray(folders) ){
            folders = [folders];
        }
        dataset = dataset || new Map();
        folders.forEach((folder)=>{
            if(!folder)return;
            const file = this.resolveAppointFile('package','package.json', folder);
            if(file && !cacheHandle.pkg.has(file)){
                this.resolveTypingsFromPackage(file, dataset); 
            }
            if(scanDependencyFlag){
                const context = path.join( file ? path.dirname(file) : folder,'node_modules');
                const deps = Utils.readdir(context, true) || [];
                deps.forEach( dep=>{
                    if(dep.endsWith("@easescript")){
                        const _deps = Utils.readdir(dep, true) || [];
                        _deps.forEach( dep=>{
                            this.resolveTypingsFromPackage(this.normalizePath(path.join(dep, 'package.json')), dataset);
                        })
                    }else{
                        this.resolveTypingsFromPackage(this.normalizePath(path.join(dep, 'package.json')), dataset);
                    }
                });
            }
        });
        return dataset;
    }

    initializeDone(){
        return !!this.initQueues.__done;
    }

    initialize(){
        return new Promise(async(resolve)=>{
            if(this.initQueues.__done){
                resolve(true);
            }else{
                this.initQueues.push(resolve);
                if(!this.initQueues.__waiting){
                    this.initQueues.__waiting = true;
                    this.initQueues.__done = false;
                    this.markMemoryUsage('compiler:initialize');
                    await this.__loadGlobalTypes();
                    await this.__loadPluginTypes();
                    const info = this.getMemoryUsage('compiler:initialize');
                    this.printLogInfo(`initialized (${info.current} MB, totoal:${info.total} MB)`, 'compiler')
                    this.initQueues.__waiting = false;
                    this.initQueues.__done = true;
                    if(this.options.service || this.options.watch){
                        this.addWatch();
                    }
                    let done = null;
                    while(done = this.initQueues.shift()){
                        done(true)
                    }
                    this.dispatcher('initialized');
                }
            }
        });
    }

    async __loadPluginTypes(){
        const options = this.options;
        const cwd = path.normalize(options.cwd || process.cwd());
        
        let dataset = new Map();
        if( options.scanTypings ){
            const scanFolders = (options.scanFolders || []).map( item=>path.normalize(item) );
            if(!scanFolders.includes(cwd)){
                scanFolders.push(cwd);
            }
            await this.scanTypings(scanFolders, true, dataset);
        }

        if( options.types && options.types.length > 0 ){
            const needScanTasks = [];
            options.types.forEach( file=>{
                file = path.isAbsolute(file) ? file : path.join(cwd, file);
                if( fs.existsSync(file) && fs.statSync(file).isFile() ){
                    if( this.isDescriptorFile(file) ){
                        let folder = path.dirname(file);
                        if( !path.isAbsolute(folder) ){
                            folder = path.join(cwd, folder);
                        }
                        const json = this.resolveAppointFile('package','package.json',folder);
                        if( json ){
                            dataset = this.resolveTypingsFromPackage(json, dataset, [file]);
                        }else if(!dataset.has(file)){
                            dataset.set(file, {
                                esconfig:{
                                    scope:'global',
                                    inherits:[]
                                },
                                folder,
                                files:[file]
                            })
                        }
                    }
                }else{
                    if( !path.isAbsolute(file) && !String(file).endsWith('node_modules') ){
                        file = path.join(cwd,'node_modules',file);
                    }
                    needScanTasks.push([file, false, dataset])
                }
            });
            await Promise.allSettled( needScanTasks.map( args=>this.scanTypings(...args) ) );
        }

        await this.doLoadPluginTypes(dataset);
    }

    async __loadGlobalTypes(){
        const globalTypes = this.options.globalTypes || []
        const items = [];
        globalTypes.forEach( filepath=>{
            const types = Utils.readdir(filepath,true);
            if( types ){
                items.push( ...types );
            }else if(filepath){
                items.push( filepath );
            }
        });
        if( items.length > 0 ){
            await this.loadTypes(items,{
                scope:'global',
                inherits:[]
            },true);
        }
    }

    async doLoadPluginTypes(dataset){
        if( dataset && dataset.size > 0 ){
            const pluginTypes = Array.from(dataset.values());
            pluginTypes.sort((a,b)=>{
                const a1 = a.esconfig.inherits;
                const b1 = b.esconfig.inherits;
                let aa = a1.length;
                let bb = b1.length;
                if(b1.includes(a1.scope)){
                    bb++;
                }else if(a1.includes(b1.scope)){
                    aa++;
                }
                return aa-bb;
            });
            return await this.callSequential(pluginTypes.map( item=>async ()=>await this.loadTypes(item.files, item.esconfig)))
            //await Promise.allSettled(pluginTypes.map( item=>this.loadTypes(item.files, item.esconfig)));
        }
    }

    async callSequential(asyncQueues){
        return await new Promise( (resolve)=>{
            const tasks = asyncQueues.slice(0);
            const items = [];
            const next = (res)=>{
                items.push(res);
                execute();
            }
            const execute=()=>{
                const callback = tasks.shift();
                if(callback) {
                    if( typeof callback ==='function'){
                        callback().then(next).catch(next);
                    }else if(callback instanceof Promise){
                        callback.then(next).catch(next);
                    }else{
                        throw new TypeError('Compiler.callSequential called an non-promise object.')
                    }
                }else{
                    resolve(items);
                }
            }
            execute();
        });
    }

    async loadTypes(types, pluginScope, isGlobal=false){
    
        if( !pluginScope || typeof pluginScope !=='object'){
            throw new Error('Invalid pluginScope');
        }else if( !pluginScope.scope || typeof pluginScope.scope !=='string' ){
            throw new Error('Invalid pluginScope.scope');
        }

        if(typeof types ==="string"){
            types = [types];
        }

        if( !Array.isArray(types) ){
            const message = Diagnostic.getMessage(this.options.lang,1095,[types]);
            throw new Error( message );
        }

        this.markMemoryUsage(this)
        this.printLogInfo(`load-types-start: ${types.join(',\n')}`, 'compiler')

        const exclude = (Array.isArray(this.options.excludeDescribeFile) ? this.options.excludeDescribeFile : []).map( file=>this.pathAbsolute(file) );
        const compilations =[];
        const createAsync = async file=>{
            const aFile = this.pathAbsolute( file );
            if( exclude.includes(aFile) || cacheHandle.create.records(aFile)){
                return;
            }
            const compilation = await this.createCompilation(aFile, null, true);
            if( compilation && !compilation.stack && !compilation.stackCreating ){
                compilation.pluginScopes = pluginScope
                compilation.import = 'scans';
                compilation.isGlobalFlag = isGlobal;
                compilation.createStack();
                compilations.push(compilation);
            }
            if( compilation && pluginScope.scope ==='global' ){
                this.globals.add(compilation);
            }
        }
        await Promise.allSettled(types.map(file=>createAsync(file)));
        await Promise.allSettled(compilations.map(compilation=>compilation.createCompleted()));
        await Promise.allSettled(compilations.map(compilation=>compilation.parserAsync()));
        const info = this.getMemoryUsage(this)
        this.printLogInfo(`load-types-done(current:${info.current} MB, total:${info.total} MB)`, 'compiler')
        return compilations;
    }

    async callAsyncSequence(items, asyncMethod){
        if(!Array.isArray(items))return false;
        if(items.length<1)return false;
        let index = 0;
        items = items.slice(0);
        const callAsync = async()=>{
            if(index<items.length){
                await asyncMethod(items[index], index++)
                await callAsync();
            }
        }
        await callAsync();
    }

    checkPlugin(plugin){
        const result = pluginInterfaces.find( item=>{
            const value = plugin[item.name];
            if( !value && item.option !== true ){
                throw new Error( `Plugin interface '${item.name}' not implemented.` );
            }
            return !item.type.includes( typeof value );
        });
        if( result ){
            throw new Error( `Plugin interface '${result.name}' implemented members type not compatible. must is "${result.type.join(',')}"` );
        }
    }

    applyPlugin(plugin){

        if( !plugin ){
            throw new Error( `Apply plugin invalid. give null` );
        }

        let pluginClass = plugin;
        let pluginOptions = null;
        if( Object.prototype.toString.call(plugin) === "[object Object]" ){
            if( Object.prototype.hasOwnProperty.call(plugin,'plugin') ){
                pluginClass = plugin.plugin;
                pluginOptions = plugin.options;
                if( typeof pluginClass === "string" ){
                    pluginClass = require(pluginClass)
                }
            }else if( Object.prototype.hasOwnProperty.call(plugin,'name') ){
                pluginClass = require(plugin.name);
                pluginOptions = plugin.options;
            }else{
                throw new Error( `Plugin config property the 'plugin' is not defined. correct as "{plugin:'plugin-name',options:{}}"` );
            }
        }

        if(typeof pluginClass !== 'function'){
            throw new Error( `Plugin is not function.` );
        }else{
            const instance = new pluginClass(this, pluginOptions||{});
            this.checkPlugin(instance);
            this.pluginInstances.push(instance);
            return instance;
        }
    }

    isPluginInContext(plugin, context, globalResult=true){
        if(typeof plugin ==='object'){
            plugin = plugin.name
        }
        return this.scopeManager.checkDocumentor(plugin, context, globalResult)
    }

    checkContenxtDescriptor(descriptor, context, globalResult=true){
        return this.scopeManager.checkDescriptor(descriptor, context, globalResult)
    }
    
    async ready(file){
        if(!this.initializeDone()){
            await this.initialize();
        }
        if(file){  
            let compilation = file;
            if(typeof file ==='string'){
                file = file.trim();
                if(file.startsWith('esglobal:')){
                    file = file.slice(9);
                }
                compilation = Namespace.globals.has(file) ? Namespace.globals.get(file).compilation : await this.createCompilation(file);
            }
            if(compilation instanceof Compilation){
                return await compilation.ready();
            }else{
                throw new Error(`The '${String(file)}' file was not resolved.`)
            }
        }
        return null;
    }
}

module.exports = Compiler;
