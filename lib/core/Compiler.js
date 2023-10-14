const Compilation  = require("./Compilation");
const CompilationGroup  = require("./CompilationGroup");
const merge  = require("lodash/merge");
const path   = require("path");
const cwd    = process.cwd();
const fs = require("fs");
const chokidar = require("chokidar");
const Utils = require("./Utils");
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
            cwd:cwd,
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
        options = merge({}, defaultOptions, options);
        let _cwd = options.cwd;
        if( options.configFileName ){
            const configData = this.loadConfigFile(_cwd, options.configFileName);
            if( configData ){
                options = merge(options, configData);
                _cwd = options.cwd;
            }
        }

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
        if( !id && isModule && moduleOrCompilation.compilation.modules.size > 1){
            id = moduleOrCompilation.getName();
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

    getFileAbsolute(file, context, flagSuffix = true ){
        if( typeof file !== "string" )return null;
        if( flagSuffix && !this.regexpSuffix.test( file ) ){
            file =file+this.suffix;
        }
        if( path.isAbsolute( file )){
            file = path.resolve(file);
        }else{
            if( context ){
                context = context.replace(/\\/g,'/');
                const resolve=(root, name)=>{
                    let file = path.join(root,name)
                    if(fs.existsSync(file))return file;
                    file = path.join(root,'node_modules',name);
                    if(fs.existsSync(file))return file;
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

    createCompilation(file, context, flag, isRoot, parentCompilation=null){
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
                }
                this.compilations.set(fileId, compilation);
                if( !flag && !isGroup && this.options.autoLoadDescribeFile && !compilation.isDescriptionType ){
                    this.loadDescriptorFiles( path.dirname(file) );
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

    loadDescriptorFiles( dirname ){

        const descFile = this.resolveIndexDescriptorFile(dirname);
        if( descFile && !DescriptorLoadedFileCache[descFile] ){
            this.loadTypes( [descFile], {scope:'local', inherits:[]});
            DescriptorLoadedFileCache[descFile] = true;
        }

        const file = this.resolvePackageFile(dirname);
        if( file ){
            const data = this.resolveTypingsFromPackage(file);
            if( data ){
                data.forEach( item=>{
                    this.loadTypes(item.files, item.esconfig);
                });
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

    resolveTypingsFromPackage(jsonFile, dataset=null, typings=null){
        try{
            if( !jsonFile || DescriptorLoadedFolderCache[jsonFile]  || !fs.existsSync(jsonFile) ){
                return null;
            }
            DescriptorLoadedFolderCache[jsonFile] = true;
            dataset = dataset || new Map();
            const toArray = (value, defaultValue=null)=>{
                if(value){
                    if( typeof value ==='string' ){
                        return value.split(',').map( item=>item.trim() );
                    }else if( Array.isArray(value) ){
                        return value.map( item=>item.trim() );
                    }
                }
                return defaultValue;
            }

            const pkg = require(jsonFile);
            let pkgName = String(pkg.name||'').trim();
            let esconfig = pkg.esconfig || {
                inherits:[],
                scope:pkgName
            }

            typings = typings || toArray(pkg.typings);
            if( typings ){
                if( !esconfig.scope ){
                    esconfig.scope = pkgName;
                }
                const folder = path.dirname(jsonFile);
                typings.forEach( file=>{
                    this.readFolderTypings(dataset, file, folder, esconfig, jsonFile);
                });
            }
        }catch(e){}
        return dataset;
    }

    resolveIndexDescriptorFile(folder, entry=null, prevs=[], ctx=null){
        if(!folder)return null;
        folder = path.normalize(folder);
        entry = entry || folder;

        const cache = ResolveIndexisFolderCache[folder];
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
        let file = path.join(folder,'index.d.es');
        if( fs.existsSync(file) ){
            file = this.normalizePath(file)
            prevs.forEach( folder=>{
                ResolveIndexisFolderCache[folder] = file;
            });
            return file;
        }else{
            const result = this.resolveIndexDescriptorFile(path.dirname(folder), entry, prevs, ctx);
            if( !result && entry === folder ){
                prevs.forEach( folder=>{
                    ResolveIndexisFolderCache[folder] = null;
                });
            }
            return result;
        }
    }

    resolvePackageFile(folder, entry=null, prevs=[], ctx=null){
        if(!folder)return null;
        folder = path.normalize(folder);
        entry = entry || folder;

        const cache = ResolvePackgeFolderCache[folder];
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

        let file = path.join(folder,'package.json');
        if( fs.existsSync(file) ){
            file = this.normalizePath(file);
            prevs.forEach( folder=>{
                ResolvePackgeFolderCache[folder] = file;
            });
            return file;
        }else{
            const result = this.resolvePackageFile(path.dirname(folder), entry, prevs, ctx);
            if(!result && entry===folder){
                prevs.forEach( folder=>{
                    ResolvePackgeFolderCache[folder] = null;
                });
            }
            return result;
        }
    }

    scanTypings( folders, scanDependencyFlag = true, dataset=null){
        if( !Array.isArray(folders) ){
            folders = [folders];
        }
        folders = folders.filter(file=>file && typeof file ==='string');
        dataset = dataset || new Map();
        const readPackage=(folder, flag)=>{
            if(!folder)return;
            folder = path.normalize(folder);
            if( folder && !DescriptorLoadedFolderCache[folder] && fs.existsSync(folder) ){
                DescriptorLoadedFolderCache[folder]=true;
                const file = this.resolvePackageFile(folder);
                if( file ){
                    this.resolveTypingsFromPackage(file, dataset)
                    if( !flag && scanDependencyFlag ){
                        const pkg = require(file);
                        const dependencies = Object.keys(pkg.dependencies||{});
                        Object.keys(pkg.devDependencies||{}).forEach( dep=>{
                            if( !dependencies.includes(dep) ){
                                dependencies.push(dep);
                            }
                        });
                        dependencies.forEach( dep=>{
                            readPackage(path.join(folder,'node_modules',dep), true);
                        });
                    }
                }
            }
        }
        folders.forEach(readPackage);
        return dataset;
    }

    initialize(){
        if(Compiler.globalTypeInitialized)return;
        Compiler.globalTypeInitialized = true;
        const globalTypes = this.options.globalTypes || []
        const items = [];
        globalTypes.forEach( filepath=>{
            const types = Utils.readdir(filepath,true);
            if( types ){
                items.push( ...types );
            }
        });

        if( items.length > 0 ){
            this.loadTypes(items,{
                scope:'global',
                inherits:[]
            });
        }


        const options = this.options;
        const cwd = path.normalize(options.cwd || process.cwd());
        let dataset = null;
        if( options.scanTypings ){
            const scanFolders = (options.scanFolders || []).map( item=>path.normalize(item) );
            if(!scanFolders.includes(cwd)){
                scanFolders.push(cwd);
            }
            dataset = this.scanTypings(scanFolders, true);
        }

        if( options.types && options.types.length > 0 ){
            const suffix = this.options.describePattern;
            options.types.forEach( file=>{
                if( fs.existsSync(file) && fs.statSync(file).isFile() ){
                    if( suffix.test(file) ){
                        let folder = path.dirname(file);
                        if( !path.isAbsolute(folder) ){
                            folder = path.join(cwd, folder);
                        }
                        const json = this.resolvePackageFile( folder );
                        if( json ){
                            dataset = this.resolveTypingsFromPackage(json, dataset, [file]);
                        }else{
                            this.loadTypes([file], {
                                scope:'unknown',
                                inherits:[]
                            });
                        }
                    }
                }else{
                    if( !path.isAbsolute(file) && !String(file).endsWith('node_modules') ){
                        file = path.join(cwd,'node_modules',file);
                    }
                    dataset = this.scanTypings(file, false, dataset)
                }
            });
        }

        if( dataset && dataset.size > 0 ){
            dataset.forEach( item=>{
                this.loadTypes(item.files, item.esconfig);
            });
        }

        // if( options.service ){
        //     const plugins = options.plugins;
        //     if( plugins && Array.isArray(plugins) ){
        //         plugins.forEach( plugin=>{
        //             if( typeof plugin !=='object' ){
        //                 plugin = {
        //                     plugin:plugin,
        //                     options:{}
        //                 };
        //             }
        //             let pluginName = plugin.plugin;
        //             try{
        //                 if( pluginName === 'function' ){
        //                     plugin.plugin(this);
        //                 }else {
        //                     pluginName = path.isAbsolute(pluginName) ? pluginName : path.join(cwd,'node_modules',pluginName)
        //                     this.applyPlugin({
        //                         plugin:require(pluginName),
        //                         options:plugin.options
        //                     });
        //                 }
        //             }catch(e){
        //                 console.error( e.message );
        //             }
        //         });
        //     }
        // }

        this.dispatcher('initialized');
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

    loadTypes(types, pluginScope){
        if( !Compiler.globalTypeInitialized ){
            this.initialize();
        }

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
        types.forEach( file=>{
            const aFile = this.pathAbsolute( file );
            if( exclude.includes( aFile ) ){
                return;
            }
            if( DescriptorLoadedFileCache[aFile] )return;
            DescriptorLoadedFileCache[aFile]= true;
            const compilation = this.createCompilation(file, null, true);
            if( compilation && !compilation.stack && !compilation.stackCreating ){
                compilation.pluginScopes = pluginScope
                compilation.createStack(null, null, false);
                compilation.import = 'scans';
                compilations.push( compilation );
            }
        });
        compilations.forEach( compilation=>{
            compilation.createCompleted();
        });
        compilations.forEach( compilation=>{
            compilation.parser();
        });
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

    start(plugins, done){
        this.initialize();
        const file = this.options.file;
        const compilation = this.createCompilation(file, null, false, true);
        if( compilation ){
            compilation.import = 'entrance';
            this.main.push( compilation );
            compilation.isMain = true;
            compilation.batch( [].concat(plugins).map( plugin=>this.applyPlugin(plugin) ) , done);
        }
    }

    build(file, plugin, done){
        this.initialize();
        const compilation = Namespace.globals.has(file) ? Namespace.globals.get(file).compilation : this.createCompilation( file );
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

Compiler.SharedInstances = SharedInstances;

module.exports = Compiler;
