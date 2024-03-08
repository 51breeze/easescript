const Compilation  = require("./Compilation");
const CompilationGroup  = require("./CompilationGroup");
const merge  = require("lodash/merge");
const path   = require("path");
const cwd    = process.cwd();
const fs = require("fs");
const chokidar = require("chokidar");
const Utils = require("./Utils");
const Manifester = require("./Manifester");
const dirname = __dirname;
const compilations = new Map();
const EventDispatcher = require("./EventDispatcher.js");
const Diagnostic  = require("./Diagnostic.js");
const Namespace = require("./Namespace"); 
const Cache = require("./Cache"); 
const PluginScopeManager = require("./PluginScopeManager"); 
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
};

class Compiler extends EventDispatcher{

    static getCompilations(){
        return compilations;
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
        this.parseOptions(options||{});
        this.pluginScopeManager=new PluginScopeManager(this);
        this.manifester = new Manifester();
        this.watchers = [];
        this.disconnected = false;
        if(this.options.service || this.options.watch){
            this.addWatch();
        }
        
        SharedInstances.push(this);
        process.on('exit', () => {
            this.dispose();
        });
    }

    clearAddDirFileCache(file){
        Cache.each((key, cache)=>{
            if(cache.name==='global'){
                return;
            }
            key = key.toLowerCase();
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

        const cache = {};
        const resolvePath=(dir,wfs)=>{
            return path.isAbsolute(dir) ? dir : path.join(wfs.options.cwd, dir);
        }

        let watchFolders = [];
        let workspacePath = this.normalizePath(this.options.cwd);
        if(Array.isArray(this.options.watchFolders)){
            watchFolders.push(...this.options.watchFolders);
        }

        const addDir = (wfs)=>(dir=>{
            if(dir){
                if(cache[dir])return;
                cache[dir] = true;
                dir = resolvePath(dir, wfs);
                dir = this.normalizePath(dir).toLowerCase();
                this.clearAddDirFileCache(dir);
                if(dir.includes('/node_modules/')){
                    this.scanTypings(dir).then( async dataset=>{
                        const result = await this.doLoadPluginTypes(dataset);
                        if(result && Array.isArray(result) && result.length > 0){
                            this.dispatcher('onAddDirCompilationDone', result.flat(), true);
                        }
                    });
                }else{
                    // const dataset = new Map();
                    // this.readFolderTypings(dataset, dir, null, {scope:'local',inherits:[]}, dir);
                    // if(dataset.size>0){
                    //     this.doLoadPluginTypes(dataset).then(result=>{
                    //         if(result && Array.isArray(result) && result.length > 0){
                    //             this.dispatcher('onAddDirCompilationDone', result.flat(), result.some(item=>item.isDescriptorDocument()));
                    //         }
                    //     });
                    // }
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
                        this.removeCompilation(compilation);
                        removed.push(compilation)
                    }
                });
                if(removed.length>0){
                    this.dispatcher('onUnlinkDirCompilationDone',removed,check);
                }
            }
        });

        fsWatcher.on('unlink',(file)=>{
            file = resolvePath(file, fsWatcher);
            const compi = this.removeCompilation(file);
            if(compi){
                this.dispatcher('onUnlinkCompilationDone', compi);
            }
        });

        if(watchFolders.length>0){
            watchFolders = Array.from((new Set(watchFolders.map(dir=>{
                if(!path.isAbsolute(dir)){
                    dir = path.join(process.cwd(),dir)
                }
                return this.normalizePath(dir);
            }))).values());
            fsWatcher.add(watchFolders.filter(folder=>workspacePath!==folder))
            .on('addDir',addDir(fsWatcher))
            .on('unlinkDir',unlinkDir(fsWatcher));
        }

        const wfs = this.createWatcher(null,4);
        wfs.add(workspacePath)
        .on('addDir',addDir(wfs))
        .on('unlinkDir',unlinkDir(wfs));
    
        let file = this.resolveConfigFile;
        if(file){
            let timerId = null;
            file = this.normalizePath(file);
            fsWatcher.add(file).on('change',(changed)=>{
                if(!changed.includes(this.options.configFileName)){
                    return;
                }

                changed = this.normalizePath(resolvePath(changed, fsWatcher));
                if(file !== changed){
                    return;
                }

                if(timerId){
                    clearTimeout(timerId);
                }
                
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
        this.clear();
        this.watchers.forEach(wfs=>{
            wfs.close();
        });
        delete this.fsWatcher;
        delete this.configFileRecords
        delete this.manifester
        delete this.pluginScopeManager
    }

    callUtils(name, ...args){
        const fun = Utils[name];
        return fun ? fun.apply(Utils, args) : false;
    }

    defaultOptions(){
        return {
            throwError:false,
            debug:false,
            diagnose:false,
            workspace:'src',
            service:false,
            enableStackMap:false,
            lang:'zh-CN',
            watch:false,
            suffix:'.es',
            plugins:[],
            types:[],
            scanFolders:[],
            cwd,
            env:{
                mode:'production'
            },
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
            annotations:[
                'Provider','Callable','Runtime','Syntax','Env','Router','Post','Get','Delete','Put','Option','Deprecated','Define','Internal','Alias',
                'Override','Dynamic','Embed','SkinClass','Abstract','WebComponent','HostComponent','Require','Required','Import','Main','Reference',
                'DOMAttribute','Injector','Reactive','Hook','URL','Http','Version','Removed','Noop'
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
                        'on':'@events',
                        'slot':'@slots',
                        'bind':'@binding',
                        'native':'@natives',
                        'direct':'@directives',
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
            resolvePaths:[],
            configFileName:'es.config.js',
            manifestFileName:'typings.json',
            globalTypes:[ path.resolve(dirname,'../typing') ],
            fileQueryParamFieldMap:{
                'id':'id',
                'type':'type',
                'file':'file',
            },
            parser:{
                sourceType:'module',
                locations:false,
                preserveParens:true,
                ecmaVersion:11,
                reserved:['global'],
            }
        }
    }

    parseOptions(options={}){
        const defaultOptions = this.defaultOptions();
        const annotations = defaultOptions.annotations.slice(0);
        const mergeArray = (target, items, type='string', errorMsg='The "options.annotations" value must is string type')=>{
            if(items && Array.isArray(items)){
                items.forEach( item=>{
                    if( typeof item === type ){
                        if( !target.includes(item) ){
                            target.push(item)
                        }
                    }else{
                        throw new TypeError( errorMsg )
                    }
                })
            }
        }

        mergeArray(annotations, options.annotations)
        options = merge({}, defaultOptions, options);
        
        let _cwd = options.cwd;
        if( options.configFileName ){
            const configFile = path.join(_cwd, options.configFileName);
            const configData = this.loadConfigFile(configFile);
            if( configData ){
                mergeArray(annotations, configData.annotations)
                options = merge(options, configData);
                _cwd = options.cwd;
            }
        }

        options.annotations = annotations;
        if( !path.isAbsolute(_cwd) ){
            Utils.error( `options.cwd is not absolute path.`);
        }

        if( options.output ){
            options.output = this.pathAbsolute( options.output )
        }else{
            options.output = path.resolve(_cwd,'build');
        }

        options.lang = String(options.lang).toLowerCase() === 'zh-cn' ? 0 : 1;
        options.workspace = path.isAbsolute(options.workspace) ? options.workspace : path.resolve(_cwd, options.workspace);
        if( !fs.existsSync(options.workspace) ){
            if( /^[a-zA-Z]+$/.test(options.workspace) ){
                options.workspace = this.getWorkspaceFolder( _cwd, options.workspace);
            }
            if( !options.workspace || fs.existsSync(options.workspace) ){
                Utils.error( `options.workspace dirname is not exists.`);
            }
        }
        options.workspace = this.normalizePath(options.workspace);
        this.options = options;
        this.suffix = options.suffix;
        this.workspace = options.workspace;
        return options;
    }

    setWorkspace(dist){
       this.workspace = this.normalizePath( path.isAbsolute(dist) ? dist : path.resolve(this.options.cwd || cwd, dist) );
       this.options.workspace = this.workspace;
       return this;
    }

    getWorkspaceFolder(context,name,depth=1){
        const exclude = ['/node_modules/'];
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

    async restartup(){
        this.restartuping = true;
        this.dispatcher('onRestartupBefore');
        await this.clear();
        await this.__loadGlobalTypes();
        await this.__loadPluginTypes();
        this.restartuping = false;
        this.dispatcher('onRestartupAfter');
    }

    async clear(){
        Namespace.clearAll();
        Cache.clearAll();
        this.errors.splice(0, this.errors.length);
        this.manifester.clear();
        this.pluginScopeManager.reset();
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
        const old = this.options
        this.parseOptions(this.rawOptions);
        if(this.options.service || this.options.watch){
            if(this.compareChanged(old, this.options)){
                this.restartup();
            }
        }
    }

    loadConfigFile(file){
        if( fs.existsSync(file) ){
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
            }
        }
        return null;
    }

    getOutputFileSystem(syntax){
        if(this.options.service)return;
        const key = `${syntax}-output`;
        if( this.filesystem.has(key) ){
            return this.filesystem.get(key);
        }
        const name = "memory-fs";
        const MemoryFileSystem = require(name);
        const filesystem =  new MemoryFileSystem();
        this.filesystem.set(key, filesystem);
        return filesystem;
    }

    getInputFileSystem(){
        if(this.options.service)return;
        const key = `input`;
        if( this.filesystem.has(key) ){
            return this.filesystem.get(key);
        }
        const name = "memory-fs";
        const MemoryFileSystem = require(name);
        const filesystem =  new MemoryFileSystem();
        this.filesystem.set(key, filesystem);
        return filesystem;
    }

    resolve(file, context){
        let isLocal = file.charCodeAt(0) === 64;
        if( isLocal )file = file.substr(1);
        if( isLocal ){
            file = this.getFileAbsolute(file, context);
            if( fs.existsSync(file) ){
                return file;
            }
            return null;
        }
        const load = (file, options )=>{
            try{ 
                return require.resolve(file, options);
            }catch{}
            return null;
        }
        const _file = file;
        file = this.getFileAbsolute(file, context);
        if( !fs.existsSync(file) ){
            file = load(_file, {
                paths:[context].concat(
                    this.options.cwd,
                    this.options.resolvePaths
                )
            });
        }
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
        if( resolveFile )segments.push(`${map.file||'file'}=${resolveFile}`);
        return segments.length > 0 ? `${file}?${segments.join('&')}` : file;
    }

    normalizePath( file ){
        if(!file)return file;
        return path.sep === "\\" ? file.replace(/\\/g, "/") : file;
    }

    getFileAbsolute(file, context, flagSuffix = true, checkNodeModules=true){
        if( typeof file !== "string" )return null;
        if( flagSuffix && !this.regexpSuffix.test( file ) ){
            file =file+this.suffix;
        }
        if( path.isAbsolute( file )){
            file = path.resolve(file);
        }else{
            if(context){
                context = context.replace(/\\/g,'/');
                const resolve=(root, name)=>{
                    let file = path.join(root,name)
                    if(fs.existsSync(file))return file;
                    if( checkNodeModules ){
                        file = path.join(root,'node_modules',name);
                        if(fs.existsSync(file))return file;
                    }
                    return null;
                };
                const section = context.split('/');
                let root = context;
                let name = file;
                while( root && !(file = resolve(root,name) ) && section.pop() ){
                    root = section.join("/");
                }
            }else{
                file = path.resolve(this.workspace,file);
            }
        }
        return this.normalizePath(file);
    }

    getRelativeWorkspace( file ){
        if( file ){
            file = this.normalizePath( file );
            if( file.includes( this.normalizePath( this.workspace ) ) ){
                return path.relative(this.workspace, file);
            }
        }
        return '';
    }

    getFileNamespace(file){
        if( path.isAbsolute(file) ){
            file = this.getRelativeWorkspace(file);
            return path.dirname(file).split( /[\\\/]+/ ).filter( val=>!!(val && !(val ==='.' || val ==='..') ) ).join('.')
        }else{
            throw new Error(`Invalid file '${file}'`);
        }
    }

    getFileClassName(file){
       return path.basename(file, this.suffix);
    }

    pathAbsolute(file){
        return this.normalizePath(path.isAbsolute( file ) ? path.resolve(file) : path.resolve(cwd,file));
    }

    removeCompilation(file){
        if(!file)return false;
        let compilation = file;
        let id = null;
        if(typeof compilation ==='string'){
            file = this.getFileAbsolute(file);
            if(file){
                id = this.getResourceId(file);
                compilation = this.compilations.get(id);
            }
        }else if(compilation && compilation.file){
            id = this.getResourceId(compilation.file);
        }
        if(compilation){
            compilation.clear(true);
            if(id){
                this.compilations.delete(id);
            }
            return compilation;
        }
        return false;
    }

    getResourceId(resourcePath){
        if(!resourcePath){
            throw new TypeError('resourcePath is null')
        }
        resourcePath = String(resourcePath).toLowerCase();
        return resourcePath.split('/node_modules/').pop();
    }

    getCompilation(file,context){
        file = this.getFileAbsolute(file,context);
        if(file){
            const resourcePath = file.toLowerCase();
            const segms = resourcePath.split('/node_modules/');
            const resourceId = segms.pop();
            if( this.compilations.has( resourceId ) ){
                return this.compilations.get( resourceId );
            }
        }
        return null;
    }

    hasCompilation(file,context){
        file = this.getFileAbsolute(file,context);
        if(file){
            const resourcePath = file.toLowerCase();
            const segms = resourcePath.split('/node_modules/');
            const resourceId = segms.pop();
            return this.compilations.has( resourceId );
        }
        return false;
    }

    async createCompilation(file, context=null, flag=false, isRoot=false, parentCompilation=null){
        const originFile = file;
        file = this.getFileAbsolute(file, context, isRoot !== true );
        if( file ){
            const resourceId = this.getResourceId(file)
            if( this.compilations.has(resourceId) ){
                return this.compilations.get(resourceId);
            }

            if(fs.existsSync(file)){
                
                const isGroup = isRoot ? fs.statSync(file).isDirectory() : false;
                const compilation = isGroup ? new CompilationGroup(this, file) : new Compilation(this, file);
                this.compilations.set(resourceId, compilation);
                compilation.originFile = originFile;

                if(!file.includes('/node_modules/')){
                    const last = path.basename(this.workspace);
                    if(file.includes('/'+last+'/')){
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
        const suffix = this.options.describePattern;
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
        }else if( stat.isFile() && (suffix.test(file) || isRoot && file.endsWith(this.suffix))){
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
        dataset = dataset || new Map();
        const pkg = require(jsonFile);
        const folder = path.dirname(jsonFile);
        let pkgName = String(pkg.name||'').trim();
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
        let file = path.join(folder, filename);
        if( fs.existsSync(file) ){
            file = this.normalizePath(file);
            prevs.forEach( folder=>{
                const key = prefix+':'+folder;
                cacheHandle.appoint.set(key, file);
            });
            return file;
        }else{
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
            const file = this.resolveAppointFile('package','package.json', folder);
            if(!cacheHandle.pkg.has(file)){
                this.resolveTypingsFromPackage(file, dataset);
                if(scanDependencyFlag){
                    const context = path.join(path.dirname(file),'node_modules');
                    const deps = Utils.readdir(context, true) || [];
                    deps.forEach( dep=>{
                        this.resolveTypingsFromPackage(this.normalizePath(path.join(dep, 'package.json')), dataset);
                    });
                }
            }
        });
        return dataset;
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
            const suffix = this.options.describePattern;
            const needScanTasks = [];
            options.types.forEach( file=>{
                file = path.isAbsolute(file) ? file : path.join(cwd, file);
                if( fs.existsSync(file) && fs.statSync(file).isFile() ){
                    if( suffix.test(file) ){
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

    async initialize(){
        if(Compiler.globalTypeInitialized)return;
        Compiler.globalTypeInitialized = true;
        await this.__loadGlobalTypes();
        await this.__loadPluginTypes();
        this.dispatcher('initialized');
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
                        callback().then(next)
                    }else if(callback instanceof Promise){
                        callback.then(next);
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
        return compilations;
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
        return this.pluginScopeManager.checkByPlugin(plugin, context, globalResult)
    }

    checkContenxtDescriptor(descriptor, context, globalResult=true){
        return this.pluginScopeManager.checkByDescriptor(descriptor, context, globalResult)
    }

    async start(plugins, done){
        throw new Error('compiler.build is deprecated. use ready method.')
        // await this.initialize();
        // const file = this.options.file;
        // const compilation = await this.createCompilation(file, null, false, true);
        // if( compilation ){
        //     compilation.import = 'entrance';
        //     this.main.push( compilation );
        //     compilation.isMain = true;
        //     compilation.batch( [].concat(plugins).map( plugin=>this.applyPlugin(plugin) ) , done);
        // }
    }

    async build(file, plugin, done){
        throw new Error('compiler.build is deprecated. use ready method.')
        // await this.initialize();
        // const compilation = Namespace.globals.has(file) ? Namespace.globals.get(file).compilation : await this.createCompilation( file );
        // if(compilation){
        //     if( !compilation.isValid() ){
        //         compilation.clear();
        //     }
        //     compilation.isMain = true;
        //     compilation.import = 'entrance';
        //     if( !compilation.parent && !compilation.isDescriptorDocument() ){
        //         if( this.main.indexOf(compilation) < 0 ){
        //             this.main.push( compilation );
        //         }
        //     }
        //     compilation.build(this.applyPlugin(plugin), done);
        // }
    }

    async ready(file){
        if(!Compiler.globalTypeInitialized){
            await this.initialize();
        }
        if(file){  
            let compilation = file;
            if(typeof file ==='string'){
                compilation = Namespace.globals.has(file) ? Namespace.globals.get(file).compilation : await this.createCompilation(file);
            }else if(!(compilation instanceof Compilation) ){
                compilation = null;
            }
            if(compilation){
                return await compilation.ready();
            }else{
                new Error(`The "${file}" is not resolve.`);
            }
        }
        return null;
    }
}

Compiler.start=( options, callback)=>{
    // const compiler = new Compiler( options );
    // if( typeof callback !=='function' ){
    //     callback = (error)=>{
    //         if( error ){
    //             const errors = Array.isArray(error) ? error : [error];
    //             errors.forEach( item=>{
    //                 const error =  item.error || item;
    //                 if( error instanceof Error ){
    //                     Utils.error( error.message );
    //                 }
    //                 console.error( error );
    //             });
    //         }else{
    //             Utils.info(`build success. output: ${compiler.options.output.replace(/\\/g,'/')}`);
    //         }
    //     }
    // }
    // compiler.start(compiler.options.plugins,callback);
}

Compiler.buildTypesManifest=async (paths, scope={}, output=null, options={})=>{
    const inherits = [];
    const compiler = new Compiler(Object.assign({
        scanTypings:false,
    },options.compilerOptions||{}));

    await compiler.initialize();
    const resolveFilePath = (paths)=>{
        const items = [];
        paths.forEach(file=>{
            const files = Utils.readdir(file, true);
            if(files){
                items.push(...files);
            }else if(file){
                items.push(file)
            }
        });
        return items;
    }

    const resolvePkgFile = (name)=>{
        try{
            return require.resolve(path.join(name,'package.json'), options.resolvePaths ? {paths:options.resolvePaths} : void 0);
        }catch(e){
            return null;
        }
    }

    const inheritScopes = [];
    const _dataset = new Map();
    const parseInherit=(name)=>{
        const file = resolvePkgFile(name);
        if(file){
            compiler.resolveTypingsFromPackage(file, _dataset)
           // const pkg = require(file)
            // const types = compiler.normalizePkgTypings(pkg.typings);
            // const esconfig = pkg.esconfig;
            // const root = path.dirname(file);
            // const files = (Array.isArray(types) ? types : [types]).map( file=>path.isAbsolute(file) ? file : path.resolve(root, file))
            // inherits.push( ...resolveFilePath(files) )
            // if( Array.isArray(esconfig.inherits) ){
            //     esconfig.inherits.forEach(parseInherit);
            // }
            // const name = (esconfig ? esconfig.scope : pkg.name) || pkg.name;
            // if(name){
            //     inheritScopes.push(name);
            // }
        }
    }

    if( Array.isArray(options.additions) && options.additions.length>0 ){
        inherits.push( ...resolveFilePath(options.additions) )
    }

    if( Array.isArray(scope.inherits) ){
        scope.inherits.forEach(parseInherit);
    }

    _dataset.forEach( value=>{
        inheritScopes.push( value.esconfig.scope )
        inherits.push( ...value.files )
    });
    
    if(inherits && inherits.length>0){
        await compiler.loadTypes(resolveFilePath(inherits), {scope:'unknown'})
    }

    paths = resolveFilePath(paths);
    await compiler.loadTypes(paths, {scope:'unknown'});
    const locals = new Set();

    paths.forEach( file=>{
        const res = compiler.getCompilation(file)
        if(res){
            locals.add(res);
        }
    });
    
    compiler.compilations.forEach( compilation=>{
        let flag = false;
        let com = compilation;
        while(com && !(flag=locals.has(com))){
            com = com.parent
        }
        if(flag){
            locals.add(compilation);
        }
    });

    if(output){
        output = path.isAbsolute(output) ? output : path.join(compiler.options.cwd, output)
        if(!/\.json/.test(output)){
            output = path.join(output, compiler.options.manifestFileName)
        }
    }else{
        output = path.join(compiler.options.cwd, compiler.options.manifestFileName)
    }

    const dataset = {};
    const files = new Set();
    const rootPath = path.dirname(output);
    const excludes = options.excludes || ['/node_modules/'];
    const exclude = (file)=>{
        return Array.isArray(excludes) && excludes.some( name=>file.includes(name) );
    }
    
    locals.forEach( compilation=>{
        if(compilation.isGlobalFlag)return;
        compilation.namespaceSets.forEach( ns=>{
            ns.modules.forEach( (item,name)=>{
                if( exclude(compilation.file) || !item.compilation)return;
                if(item.compilation.isGlobalFlag)return;
                let isLocal = item.compilation === compilation;
                if(item.isModule){
                    isLocal = item.files.includes(compilation.file)
                }
                if(isLocal && !inheritScopes.includes(compilation.pluginScopes.scope) ){
                    const descFiles = item.isModule ? item.files : [item.compilation.file];
                    const key = ns.identifier ? `${ns.fullName}.${name}` : name;
                    const data = dataset[key] || (dataset[key] = {indexers:[]});
                    descFiles.forEach( file=>{
                        if(!files.has(file)){
                            files.add(file);
                        }
                        const index = files.size-1;
                        if( !data.indexers.includes(index) ){
                            data.indexers.push(index);
                        }
                    })
                }
            });
        })
    });

    const relativeModulePath = compiler.normalizePath(path.join(compiler.options.cwd, 'node_modules'))
    const jsondata = {
        scope,
        files:Array.from(files.values()).map( file=>{
            if(file.includes(relativeModulePath)){
                return compiler.normalizePath(path.join(path.relative(output, compiler.options.cwd), path.relative(relativeModulePath,file)))
            }
            return compiler.normalizePath(path.relative(rootPath,file))
        }),
        types:dataset
    }
    let dir = output
    const segs = [];
    while( dir && !fs.existsSync( dir = path.dirname(dir) ) ){
        segs.push( dir );
    }
    while( segs.length > 0 ){
        fs.mkdirSync( segs.pop() );
    }
    fs.writeFileSync(output, JSON.stringify(jsondata));

    console.info(`build successful output: '${output}'`)

    return true;
}

Compiler.SharedInstances = SharedInstances;

module.exports = Compiler;
