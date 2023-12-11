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

const DescriptorLoadedFolderCache = {};
const DescriptorLoadedFileCache = {};
const CreatedDescriptorCache = {};
const ReadFolderTypingCache = {};
const ResolvePackgeFolderCache = {};
const ResolveIndexisFolderCache = {};
const SharedInstances = [];

class Compiler extends EventDispatcher{

    static getCompilations(){
        return compilations;
    }

    constructor(options){
        super(); 
        options = this.parseOptions(options||{});
        this.options = options;
        this.compilations = compilations;
        this.suffix = this.options.suffix;
        this.main = [];
        this.regexpSuffix = /\.[a-zA-Z]+$/
        this.workspace = options.workspace;
        this.lowerWorkspace = options.workspace ? options.workspace.toLowerCase() : '';
        this.filesystem = new Map();
        this.grammar  = new Map();
        this.errors=[];
        this.utils = Utils;
        this.diagnostic = Diagnostic;
        this.pluginInstances = [];
        if( options.service || options.watch){
            this.createWatcher( options.watchOptions );
            if(options.service){
                this.fsWatcher.on('unlink',(file)=>{
                    this.removeCompilation(file);
                });
            }
        }
        this.pluginScopeManager=new PluginScopeManager(this);
        this.manifester = new Manifester();
        SharedInstances.push(this);
    }

    createWatcher(options){
        let fsWatcher = this.fsWatcher;
        if( !fsWatcher ){
            options = options || {persistent: true};
            this.fsWatcher = fsWatcher = new chokidar.FSWatcher(options);
        }
        return fsWatcher;
    }

    dispose(){
        if( this.fsWatcher ){
            this.fsWatcher.close();
            this.fsWatcher = null;
        }
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
            lang:1,
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
            watchOptions:{persistent: true},
            annotations:[
                'Provider','Callable','Runtime','Syntax','Env','Router','Post','Get','Delete','Put','Option','Deprecated','Define','Internal','Alias',
                'Override','Dynamic','Embed','SkinClass','Abstract','WebComponent','HostComponent','Require','Required','Import','Main','Reference',
                'DOMAttribute','Injector','Reactive','Hook','URL','Http','Version'
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
            manifestFileName:'es.types.json',
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
            const configData = this.loadConfigFile(_cwd, options.configFileName);
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
        return options;
    }

    setWorkspace(dist){
       this.workspace = this.normalizePath( path.isAbsolute(dist) ? dist : path.resolve(this.options.cwd || cwd, dist) );
       this.options.workspace = this.workspace;
       this.lowerWorkspace = this.workspace.toLowerCase();
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

    normalizeModuleFile(moduleOrCompilation, id, type, resolveFile ){
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
        file = this.getFileAbsolute( file );
        const fileId = file && file.toLowerCase();
        const compilation = this.compilations.get( fileId );
        if( compilation ){
            compilation.clear();
            return this.compilations.delete( fileId );
        }
        return false;
    }

    getCompilation(file,context){
        file = this.getFileAbsolute(file,context);
        const fileId = file && file.toLowerCase();
        if( fileId && this.compilations.has( fileId ) ){
            return this.compilations.get( fileId );
        }
        return null;
    }

    hasCompilation(file,context){
        file = this.getFileAbsolute(file,context);
        const fileId = file && file.toLowerCase();
        return this.compilations.has( fileId );
    }

    async createCompilation(file, context, flag=false, isRoot=false, parentCompilation=null){
        const originFile = file;
        file = this.getFileAbsolute(file, context, isRoot !== true );
        if( file ){
            const fileId = file.toLowerCase();
            if( this.compilations.has( fileId ) ){
                return this.compilations.get( fileId );
            }
            if( fs.existsSync(file) ){
                if( this.options.service || this.options.watch){
                    if( this.fsWatcher ){
                        this.fsWatcher.add(file);
                    }
                }
                const isGroup = isRoot ? fs.statSync(file).isDirectory() : false;
                const compilation = isGroup ? new CompilationGroup(this, file) : new Compilation(this, file);
                compilation.originFile = originFile;
                if( fileId.includes( this.lowerWorkspace ) ){
                    compilation.pluginScopes.scope='local';
                    compilation.pluginScopes.inherits = [];
                }
                this.compilations.set(fileId, compilation);
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
        if( descFile && !DescriptorLoadedFileCache[descFile] ){
            DescriptorLoadedFileCache[descFile] = true;
            await this.loadTypes( [descFile], {scope:'local', inherits:[]});
        }else{
            const file = this.resolveAppointFile('package','package.json', dirname);
            if( file ){
                const data = this.resolveTypingsFromPackage(file);
                if( data && data.size>0 ){
                    await Promise.allSettled(Array.from(data.values()).map(this.loadTypes(item.files, item.esconfig)))
                }
            }
        }
    }

    readFolderTypings(data, file, context, esconfig, scopeFile){
        const suffix = this.options.describePattern;
        file = path.isAbsolute(file) ? file : path.join(context, file);
        file = this.normalizePath(file);
        if(!file || ReadFolderTypingCache[file] || !fs.existsSync(file))return;
        ReadFolderTypingCache[file] = true;
        const stat = fs.statSync( file );
        if( stat.isDirectory() ){
            const result = Utils.readdir(file);
            if(result){
                result.forEach(name=>{
                    this.readFolderTypings(data, path.join(file,name), file, esconfig, scopeFile);
                });
            }
        }else if( stat.isFile() && suffix.test(file) ){
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
        try{
            if( !jsonFile || DescriptorLoadedFolderCache[jsonFile]  || !fs.existsSync(jsonFile) ){
                return null;
            }
            DescriptorLoadedFolderCache[jsonFile] = true;
            dataset = dataset || new Map();
            const pkg = require(jsonFile);
            const folder = path.dirname(jsonFile);
            let pkgName = String(pkg.name||'').trim();
            let esconfig = pkg.esconfig || {
                inherits:[],
                scope:pkgName
            }

            if( !typings && esconfig.manifest ){
                const manifestPath = this.getFileAbsolute(esconfig.manifest, folder, false, false);
                if( manifestPath ){
                    this.manifester.add(require(manifestPath), path.dirname(manifestPath));
                    return;
                }
            }

            const _typings = typings || this.normalizePkgTypings(pkg.typings);
            if( _typings ){
                if(!typings){
                    const hasManifest = _typings.some( file=>{
                        file = path.isAbsolute(file) ? file : path.join(folder, file);
                        const manifestPath = /\.json$/.test(file) ? file : path.join(path.dirname(file), this.options.manifestFileName);
                        if( fs.existsSync(manifestPath) ){
                            this.manifester.add(require(manifestPath), path.dirname(manifestPath));
                            return true;
                        }
                        return false;
                    });
                    if( hasManifest ){
                        return;
                    }
                }
                if( !esconfig.scope ){
                    esconfig.scope = pkgName;
                }
                _typings.forEach( file=>{
                    this.readFolderTypings(dataset, file, folder, esconfig, jsonFile);
                });
            }
        }catch(e){}
        return dataset;
    }

    resolveAppointFile(prefix, filename, folder, entry=null, prevs=[], ctx=null){
        if(!folder)return null;
        if(!fs.existsSync(folder))return null;
        folder = path.normalize(folder);
        entry = entry || folder;
        const key = prefix+':'+folder;
        const cache = ResolveIndexisFolderCache[key];
        if( cache !== void 0 ){
            return cache;
        }
        if( ctx === null ){
            ctx = path.normalize(this.options.cwd || process.cwd());
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
                ResolveIndexisFolderCache[key] = file;
            });
            return file;
        }else{
            const result = this.resolveAppointFile(prefix, filename, path.dirname(folder), entry, prevs, ctx);
            if(!result && entry===folder){
                prevs.forEach( folder=>{
                    const key = prefix+':'+folder;
                    ResolveIndexisFolderCache[key] = null;
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
            if(file && !DescriptorLoadedFolderCache[file]){
                DescriptorLoadedFolderCache[file] = true;
                if(scanDependencyFlag){
                    const context = path.join(path.dirname(file),'node_modules');
                    const deps = Utils.readdir(context, true) || [];
                    deps.forEach( dep=>{
                        const pkg = path.join(dep, 'package.json');
                        if( fs.existsSync(pkg) ){
                            this.resolveTypingsFromPackage(pkg, dataset);
                        }
                    });
                }else{
                    this.resolveTypingsFromPackage(file, dataset);
                }
            }
        });
        return dataset;
    }

    async initialize(){
        if(Compiler.globalTypeInitialized)return;
        Compiler.globalTypeInitialized = true;
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
            });
        }

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
                    needScanFiles.push([file, false, dataset])
                }
            });
            await Promise.allSettled( needScanTasks.map( args=>this.scanTypings(...args) ) );
        }

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
            await this.callSequential(pluginTypes.map( item=>async ()=>await this.loadTypes(item.files, item.esconfig)))
            //await Promise.allSettled(pluginTypes.map( item=>this.loadTypes(item.files, item.esconfig)));
        }
        this.dispatcher('initialized');
    }

    async callSequential(asyncFunList){
        return await new Promise( (resolve)=>{
            const tasks = asyncFunList.slice(0);
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
                        throw new TypeError('callSequential called an non-promise object.')
                    }
                }else{
                    resolve(items);
                }
            }
            execute();
        });
    }

    loadConfigFile(filepath, filename){
        const config_file = path.join(filepath, filename);
        if( fs.existsSync( config_file ) ){
            try{
                const config = require( config_file );
                let data = config ==='function' ? config(this) : config;
                if( Object.prototype.toString.call(data) !== '[object Object]' ){
                    data = {};
                    console.error(`config file export data type can only is object. in '${config_file}'`);
                }
                return data;
            }catch(e){
                console.error(`${e.message} in '${config_file}'`);
            }
        }
    }

    async loadTypes(types, pluginScope){
    
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
            if( exclude.includes( aFile ) ){
                return;
            }
            if( CreatedDescriptorCache[aFile] )return;
            CreatedDescriptorCache[aFile]= true;
            const compilation = await this.createCompilation(file, null, true);
            if( compilation && !compilation.stack && !compilation.stackCreating ){
                compilation.pluginScopes = pluginScope
                compilation.import = 'scans';
                compilation.createStack();
                compilations.push(compilation);
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
        await this.initialize();
        const file = this.options.file;
        const compilation = await this.createCompilation(file, null, false, true);
        if( compilation ){
            compilation.import = 'entrance';
            this.main.push( compilation );
            compilation.isMain = true;
            compilation.batch( [].concat(plugins).map( plugin=>this.applyPlugin(plugin) ) , done);
        }
    }

    async build(file, plugin, done){
        await this.initialize();
        const compilation = Namespace.globals.has(file) ? Namespace.globals.get(file).compilation : await this.createCompilation( file );
        if(compilation){
            if( !compilation.isValid() ){
                compilation.clear();
            }
            compilation.isMain = true;
            compilation.import = 'entrance';
            if( !compilation.parent && !compilation.isDescriptorDocument() ){
                if( this.main.indexOf(compilation) < 0 ){
                    this.main.push( compilation );
                }
            }
            compilation.build(this.applyPlugin(plugin), done);
        }
    }

    async ready(file, callback){
        await this.initialize();
        const compilation = Namespace.globals.has(file) ? Namespace.globals.get(file).compilation : await this.createCompilation(file);
        if(compilation){
            if(!compilation.isValid()){
                compilation.clear();
            }
            await compilation.parserAsync();
            if(typeof callback==='function'){
                callback(compilation);
            }
            return compilation;
        }else{
            throw new Error(`The "${file}" is not resolve.`)
        }
    }
}

Compiler.start=( options, callback)=>{
    const compiler = new Compiler( options );
    if( typeof callback !=='function' ){
        callback = (error)=>{
            if( error ){
                const errors = Array.isArray(error) ? error : [error];
                errors.forEach( item=>{
                    const error =  item.error || item;
                    if( error instanceof Error ){
                        Utils.error( error.message );
                    }
                    console.error( error );
                });
            }else{
                Utils.info(`build success. output: ${compiler.options.output.replace(/\\/g,'/')}`);
            }
        }
    }
    compiler.start(compiler.options.plugins,callback);
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

    const inheritScopes = []
    const parseInherit=(name)=>{
        const file = resolvePkgFile(name);
        if(file){
            const pkg = require(file)
            const types = compiler.normalizePkgTypings(pkg.typings);
            const esconfig = pkg.esconfig;
            const root = path.dirname(file);
            const files = (Array.isArray(types) ? types : [types]).map( file=>path.isAbsolute(file) ? file : path.resolve(root, file))
            inherits.push( ...resolveFilePath(files) )
            if( Array.isArray(esconfig.inherits) ){
                esconfig.inherits.forEach(parseInherit);
            }
            const name = (esconfig ? esconfig.scope : pkg.name) || pkg.name;
            if(name){
                inheritScopes.push(name);
            }
        }
    }

    if( Array.isArray(options.additions) && options.additions.length>0 ){
        inherits.push( ...resolveFilePath(options.additions) )
    }

    if( Array.isArray(scope.inherits) ){
        scope.inherits.forEach(parseInherit);
    }
    
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
        compilation.namespaceSets.forEach( ns=>{
            ns.modules.forEach( (item,name)=>{
                if( exclude(compilation.file) )return;
                if(item.compilation && item.compilation === compilation && !inheritScopes.includes(compilation.pluginScopes.scope) ){
                    const file = item.compilation.file;
                    const key = ns.identifier ? `${ns.fullName}.${name}` : name;
                    const data = dataset[key] || (dataset[key] = {indexers:[]});
                    if(!files.has(file)){
                        files.add(compiler.normalizePath(path.relative(rootPath,item.compilation.file)));
                    }
                    const index = files.size-1;
                    if( !data.indexers.includes(index) ){
                        data.indexers.push(index);
                    }
                }
            });
        })
    });

    const jsondata = {
        scope,
        files:Array.from(files.values()),
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

    return true;
}

Compiler.SharedInstances = SharedInstances;

module.exports = Compiler;
