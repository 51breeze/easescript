const fs     = require("fs");
const path     = require("path");
const TopScope = require("../scope/TopScope.js");
const Parser = require("./Parser.js");
const Namespace = require("./Namespace.js");
const Module = require("./Module");
const Utils  = require("./Utils.js");
const Diagnostic  = require("./Diagnostic.js");
const Range  = require("./Range.js");
const EventDispatcher = require("./EventDispatcher.js");
const Constant = require("./Constant.js");
const Tokens = require("../tokens");
const symbolKey = Symbol('key');
const PARSER_TAG_REGEXP = /(?<=(?:[\s\r\n]+|^)\/\/\/)[\s+]?<(scope|reference)\s+(.*?)\/\>/ig;
const PARSER_TAG_ATTR_REGEXP = /\b(name|inherits|file|isDir)[\s+]?=[\s+]?([\'\"])([^\2]*?)\2/g;
const SortedMap = {
    'manifest':-5,
    'reference':-5,
    'scans':-5,
}
class Compilation extends EventDispatcher{
    [Utils.IS_COMPILATION] = true;

    static is(value){
        return value ? value instanceof Compilation : false;
    }

    constructor( compiler, file ){
        super();
        this.compiler = compiler;
        this.modules = new Map();
        this.stacks = new Map();
        this._namespace = null;
        this.namespaceSets = new Set();
        this.children = [];
        this.parent = null;
        this.scope= new TopScope(null);
        this.stack=null;
        this.ast = null;
        this.isMain = false;
        this.errors = [];
        this.mtime = null;
        this.file = file;
        this.import = null;
        this.dependencies=new Set();
        this.dependencyCompilations = new Set();
        this.assets = new Map();
        this.requires = new Map();
        this.originId = null;
        this.originFile = null;
        this.source = '';
        this.JSX = false;
        this.stackCreating=false;
        this.mainModule = null;
        this[symbolKey]={
            policy:Constant.POLICY_NONE,
            building:false,
            waitCallback:[],
            waiting:[],
            completed:{},
            hooks:{},
            scope:void 0,
            parserDoneFlag:false,
            parseringFlag:false,
            cacheKey:Date.now()
        };
        this.jsxStyles = [];
        this.jsxElements = [];
        this.pluginScopes = Object.create(null);
        this.referenceStacks = new Set();
        this.referenceCompilations = new Set();
        this.namespace = Namespace.dataset;
        this.loadDependencies = new Set();
        this.isGlobalFlag = false;
        this.isDestroyed = false;
        this.emitComments = [];
        this.importModules = new Map();
        this.importModuleNameds = new Map();
        this.hasDeclareJSModule = false;
        this.changed = false;
    }

    getScopeName(){
        let scope = this[symbolKey].scope;
        if(scope !== void 0)return scope;
        return this[symbolKey].scope = this.compiler.scopeManager.resolveScopeName(this.file);
    }

    hasDescriptorReferenceName(desc){
        const refs = this[symbolKey].descriptorReferences;
        return refs ? refs.has(desc) : false;
    }

    getDescriptorReferenceName(desc){
        const refs = this[symbolKey].descriptorReferences;
        return refs ? refs.get(desc) : null;
    }

    setDescriptorReferenceName(desc, name){
        const refs = this[symbolKey].descriptorReferences || (this[symbolKey].descriptorReferences = new Map());
        refs.set(desc, name);
    }

    hookAsync(name, callback){
        const hooks = this[symbolKey].hooks;
        const items = hooks[name] || (hooks[name]=[])
        items.push(callback);
    }

    removeHook(name, callback){
        const hooks = this[symbolKey].hooks;
        if(hooks){
            const items = hooks[name]
            if(items){
                const index = items.indexOf(callback);
                if(index>=0){
                    items.splice(index, 1);
                }
            }
        }
    }

    async callHookAsync(name, always=false){
        const hooks = this[symbolKey].hooks;
        const queues = hooks[name] || (hooks[name]=[])
        try{
            const items = always ? queues.slice(0) : queues.splice(0, queues.length);
            await Promise.allSettled(items.map(callback=>callback()));
        }catch(e){
            console.error(e);
        }
    }

    get isDescriptionType(){
        return this.isDescriptorDocument();
    }

    setPluginScopes(scopes){
        if( !this.pluginScopes.scope ){
            this.pluginScopes.scope = scopes.scope; 
        }
        if( scopes.inherits && Array.isArray(scopes.inherits) && scopes.inherits.length > 0){
            const old = this.pluginScopes.inherits;
            if(!old){
                this.pluginScopes.inherits = scopes.inherits.slice(0);
            }else{
                scopes.inherits.forEach( name=>{
                    if( !old.includes( name ) ){
                        old.push(name);
                    }
                })
            }
        }
    }

    isDescriptorDocument( isGlobal ){
        if(this[symbolKey].isDescriptorFlag != null){
            return this[symbolKey].isDescriptorFlag;
        }
        let result = false;
        if( this.file ){
            if( isGlobal && this.pluginScopes.scope !== 'global' ){
                result = false;
            }else{
                result = this.compiler.isDescriptorFile(this.file);
            }
        }
        return this[symbolKey].isDescriptorFlag = result;
    }

    isLocalDocument(){
        if(this.pluginScopes.scope==='local'){
            return true;
        }
        if(this[symbolKey].isLocalFlag == null){
            let file = String(this.file).toLowerCase();
            return this[symbolKey].isLocalFlag = this.compiler.getWorkspaceFolders().some(folder=>{
                return file.includes(String(folder).toLowerCase())
            })
        }
        return this[symbolKey].isLocalFlag;
    }

    isGlobalDocument(){
        return this.compiler.globals.has(this);
    }

    addReferenceStack(stack){
        if( stack && stack.isStack && stack.compilation !== this ){
            this.referenceStacks.add(stack);
        }
    }

    set namespace(value){
        this.namespaceSets.add( value );
        this._namespace = value;
    }

    get namespace(){
        return this._namespace;
    }

    completed(plugin, value){
        if( !plugin || typeof plugin.platform !== 'string'  ){
            throw new Error('Invalid plugin instanced.')
        }
        const key = plugin.name+':'+plugin.platform;
        if( value !== void 0 ){
            this[symbolKey].completed[key] = value;
        }
        return !!this[symbolKey].completed[key];
    }

    get policy(){
        return this[symbolKey].policy;
    }
    
    setPolicy(policy, module){
        if( (Constant.POLICY_ALL & policy) === policy){
            if( module ){
                module.policy=policy;
            }else{
                this[symbolKey].policy = policy;
                this.modules.forEach( module=>{
                    module.policy=policy;
                });
            }
        }
    }

    isPolicy(policy, module){
        const value = module ? module.policy : this.policy;
        return (value & policy) === value;
    }

    isServerPolicy(module, explicit=false){
        if( !module )return false;
        if( module && !module.isModule )return !explicit;
        const value = module ? module.policy : this.policy;
        if( value === Constant.POLICY_ALL ){
            return true;
        }else if( !explicit && value === Constant.POLICY_NONE ){
            if( module && module.inherit ){
                return this.isServerPolicy( module.inherit );
            }else{
                return true;
            }
        }
        return (value & Constant.POLICY_SERVER) === value;
    }

    setServerPolicy(module){
        this.setPolicy(Constant.POLICY_SERVER, module)
    }

    isClientPolicy(module, explicit=false){
        if( !module )return false;
        const value = module ? module.policy : this.policy;
        if( module && !module.isModule )return !explicit;
        if( value === Constant.POLICY_ALL ){
            return true;
        }else if(!explicit && value === Constant.POLICY_NONE ){
            if( module && module.inherit ){
                return this.isClientPolicy( module.inherit );
            }else{
                return true;
            }
        }
        return (value & Constant.POLICY_CLIENT) === value;
    }

    setClientPolicy(module){
        this.setPolicy(Constant.POLICY_CLIENT, module);
    }

    addStack( stack ){
        if( stack.node.start > 0 ){
            this.stacks.set(stack.node.start,stack);
        }
    }

    checkDescriptor(desc, document){
        if( desc && desc.compilation){
            const ctx = module || this;
            if( desc.compilation === this || desc === module )return true;
            const scopes = desc.compilation.pluginScopes;
            if( scopes && scopes.scope !== 'global' ){
                const plugin = this.compiler.pluginInstances.find( plugin=>this.compiler.isMatchPluginNameOf(plugin.name, scopes) );
                if(plugin){
                    return this.compiler.isPluginInContext(plugin, ctx);
                }
            }

        }
        return true;
    }

    addDependency(dep, module){
        if( dep && dep !== this ){
            if(module && module.isModule){
                module.addDepend(dep);
                if(dep.isModule && dep.compilation && dep.compilation !== this ){
                    dep.compilation.referenceCompilations.add(this)
                    this.dependencyCompilations.add(dep.compilation)
                }else if(dep instanceof Compilation){
                    dep.referenceCompilations.add(this)
                    this.dependencyCompilations.add(dep)
                }
            }else{
                dep.used = true;
                this.dependencies.add(dep);
                if(dep.isModule && dep.compilation && dep.compilation !== this ){
                    dep.compilation.referenceCompilations.add(this)
                    this.dependencyCompilations.add(dep.compilation)
                }else if(dep instanceof Compilation){
                    dep.referenceCompilations.add(this)
                    this.dependencyCompilations.add(dep);
                }
            }
        }
    }

    addAsset(resolve,file,content,type,assign,attrs=null,stack=null){
        const key = resolve;
        const old = this.assets.get(key)
        const cacheId = this.cacheId
        if( !old ){
            const obj = {
                file,
                resolve,
                content,
                type,
                assign,
                id:null,
                index:this.assets.size,
                attrs,
                cacheId,
                stack
            };
            this.assets.set(key, obj);
            return obj;
        }else if( old.cacheId !== cacheId ){
            old.cacheId = cacheId
            return old
        }
        return false;
    }

    addRequire(key,name,from,resolve,extract,stack=null, isAutoImporter = false){
        let cacheKey = name+':'+resolve;
        const cacheId = this.cacheId
        const old = this.requires.get(cacheKey);
        if( !old ){
            const obj = {
                key,
                name,
                from,
                resolve,
                extract, 
                isAutoImporter, 
                stack,
                cacheId,
                namespaced:key==="*",
                id:null,
                index:this.requires.size
            };
            this.requires.set(cacheKey,obj);
            return obj;
        }else if( old.cacheId !== cacheId ){
            old.cacheId = cacheId
            return old
        }
        return false;
    }

    getDependencies( module ){
        if( module && module.isModule ){
            return Array.from( module.dependencies.values() );
        }
        return Array.from( this.dependencies.values() );
    }

    getCompilationsOfDependency(){
        return this.dependencyCompilations;
    }

    getStackByAt( startAt, tryNum=3, both=0){
        let stack = this.stacks.get( startAt );
        if( !stack ){
            let offset = 0;
            if(tryNum < 0){
                tryNum = both===0 ? this.stacks.size / 2 : this.stacks.size;
            }
            while(!stack && offset < tryNum){
                offset++;
                if( both === 0 ){
                   stack = this.stacks.get( startAt - offset ) || this.stacks.get( startAt + offset );
                }else if( both < 0 ){
                   stack = this.stacks.get( startAt - offset )
                }else if( both > 0){
                   stack = this.stacks.get( startAt + offset )
                }
            }
        }
        return stack;
    }

    addModuleStack(module,stack){
        if(module && module.isModule){
            module.moduleStack = stack;
        }
    }

    getStackByModule(module){
        if(module && module.isModule){
            return module.moduleStack;
        }
        return null;
    }

    hasSameDiagnostic(node, code, range=null, kind=0){
        return this.errors.some( error=>{
            if(this.file===error.file && error.code === code && error.kind===kind ){
                if(range){
                    if(range.start.line === error.range.start.line && range.end.line === error.range.end.line){
                        return range.end.column === error.range.end.column;
                    }
                }else if(node.loc && typeof node.loc.start === 'object'){
                    if(node.loc.start.line === error.range.start.line && node.loc.end.line === error.range.end.line){
                        return node.loc.start.column === error.range.end.column;
                    }
                }
            }
        });
    }

    error(node,code,...args){
        
        const range = this.getRangeByNode( node );
        if(this.hasSameDiagnostic(node, code, range, 0)){
            return 
        }

        const message = Diagnostic.getMessage(code,args);
        const error = new Diagnostic(this.file, message, range , Diagnostic.ERROR, node, code);
        if( this.compiler.options.debug ){
            Utils.debug(error.toString());
            if( node instanceof Error){
                console.log( node )
            }
        }
       
        if(this.compiler.options.diagnose){
            this.errors.push(error);
            this.compiler.errors.push( error );
        }else if( !this.compiler.options.debug ){
            Utils.error(error.toString()); 
        }
    }

    warn(node,code,...args){
        const range = this.getRangeByNode(node);
        if(this.hasSameDiagnostic(node, code, range, 1)){
            return 
        }
        const message = Diagnostic.getMessage(code,args);
        const warn = new Diagnostic(this.file, message, range , Diagnostic.WARN, node,code);
        if( this.compiler.options.debug ){
            Utils.debug(warn.toString() ); 
            if( node instanceof Error){
                console.log( node )
            } 
        }
        if( this.compiler.options.diagnose ){
            this.errors.push( warn );
            this.compiler.errors.push( warn );
        }else if( !this.compiler.options.debug ){
            Utils.warn(warn.toString() );
        }
    }

    deprecated(node,code,...args){
        const range = this.getRangeByNode(node);
        if(this.hasSameDiagnostic(node, code, range, 2)){
            return 
        }
        const message = Diagnostic.getMessage(code,args);
        const warn = new Diagnostic(this.file, message, range , Diagnostic.DEPRECATED, node,code);
        if( this.compiler.options.diagnose ){
            this.errors.push( warn );
            this.compiler.errors.push( warn );
        }
    }

    unnecessary(node,code,...args){
        const range = this.getRangeByNode(node);
        if(this.hasSameDiagnostic(node, code, range, Diagnostic.UNNECESSARY)){
            return 
        }
        const message = Diagnostic.getMessage(code,args);
        const warn = new Diagnostic(this.file, message, range , Diagnostic.UNNECESSARY, node,code);
        if( this.compiler.options.diagnose ){
            this.errors.push( warn );
            this.compiler.errors.push( warn );
        }
    }

    getReference(key,target,isStatic,kind=null){
        if( target && target instanceof Module ){
            if( isStatic ){
                return target.getMethod( key, kind );
            }
            return target.getMember( key, kind );
        }else if( target instanceof Namespace ){
            return target.get( key )
        }
        return !target ? this.getModuleById( key ) : null;
    }

    getDescriptor(key,target,filter){
        if( target && target instanceof Module ){
            return target.getDescriptor(key, filter);
        }else if( target instanceof Namespace ){
            return target.get( key )
        }
        return !target ? this.getModuleById( key ) : null;
    }

    getReferenceName(desc, context=null, flag=false){
        if(!context){
            context = this.mainModule;
        }

        if(this.importModuleNameds.has(desc)){
            return this.importModuleNameds.get(desc);
        }

        if(context){
            if(Module.is(context)){
                return context.getReferenceNameByModule(desc, flag);
            }
            if(context !== this && Compilation.is(context)){
                return context.getReferenceName(desc, context, flag)
            }
        }
        if(Module.is(desc)){
            const key = desc.id;
            const req = this.requires.get(key);
            if(req && req.isAutoImporter)return req.name;
            if(!flag){
                return desc.getName('_');
            }
        }
        return null;
    }

    getRangeByNode( node ){
        if( node.loc){
            if( node.loc.start && node.loc.end){
                return new Range(node.loc.start,node.loc.end);
            }else{
                return new Range(node.loc, Object.assign({},node.loc,{column:node.loc.column+(node.raisedAt-node.pos)}));
            }
        }
        const str = this.source.substring(0,node.start+1);
        const lines=str.split(/\r\n/);
        const startLineText = lines.length > 0 ? lines[lines.length-1] : str;
        const column = node.start - (str.length - startLineText.length);
        const start  = {line:lines.length,column};
       
        const endStr = this.source.substring(node.start,node.end+1);
        const endLines=endStr.split(/\r\n/);
        const endLineText = endLines.length > 0 ? endLines[endLines.length-1] : endStr;
        const endColumn  = node.end - (endStr.length - endLineText.length);
        const end        = {line:endLines.length+lines.length,column:endColumn};
        return new Range(start,end);
    }

    getTypeValue(type, isLoadDependency=false){
        if(isLoadDependency && type){
            const compilation = type.compilation;
            if( compilation instanceof Compilation && !compilation.parserDoneFlag){
                this.loadDependencies.add(compilation);
            }
        }
        if(type && Utils.isStack(type)){
            if( type.isDeclaratorFunction || type.isDeclaratorVariable ){
                return type;
            }
            return type.type();
        }
        return type;
    }
    
    getTypeById(id){
        if( this.modules.has(id) ){
            return this.getTypeValue(this.modules.get(id))
        }
        return Namespace.globals.get(id);
    }

    getGlobalTypeById(id){
        return Namespace.globals.get(id);
    }

    async createChildCompilation(file, context, originId=null, notLoadDescribeFile=false){
        const compilation = await this.compiler.createCompilation(file, context, notLoadDescribeFile, false, this);
        if(compilation){
            if(compilation !== this && !compilation.stack && !this.stackCreating){
                compilation.originId = originId || file;
                Object.assign(compilation.pluginScopes,this.pluginScopes);
                compilation.createStack();
            }
            this.dependencyCompilations.add(compilation)
        }
        return compilation;
    }

    hasModuleById(id, context){
        if(context && context.isNamespace){
            if( context.has(id) ){
                return true
            }
        }else if(context && context.isModule ){
            if(context.imports.has(id) || context.namespace.has(id)){
                return true;
            }
        }
        if(this.importModules.has(id)){
            return true;
        }
        if(this.modules.has(id)){
            return true
        }
        if(Namespace.globals.has(id)){
            return true
        }
        return false;
    }

    getModuleById(id, context=null){
        
        if(context && context.isNamespace){
            if( context.has(id) ){
                return this.getTypeValue(context.get(id), true);
            }
        }else if( context && context.isModule ){
            const result = context.getImport(id) || context.namespace.get(id);
            if( result ){
                return this.getTypeValue(result, true);
            }
        }

        if(this.importModules.has(id)){
            return this.getTypeValue(this.importModules.get(id), true);
        }

        if(this.modules.has(id)){
            return this.getTypeValue(this.modules.get(id), true);
        }

        if(Namespace.globals.has(id)){
            return this.getTypeValue(Namespace.globals.get(id), true);
        }
        return null;
    }

    async loadTypeAsync(id, context=null, isImporter=false){
        let type = null;
        let ns = null;
        if(!isImporter){
            type = this.getModuleById(id, context, true);
            if(type===false)return null;
            if(type)return type;
            ns = this.namespace;
            if(context){
                if(Namespace.is(context)){
                    ns = context;
                }else if(Module.is(context)){
                    ns = context.namespace;
                }
            }
        }

        if(!this.isDescriptorDocument()){
            let idString = String(id);
            let file = null;
            if( idString.includes('.') ){
                file = this.compiler.resolveManager.resolveFile( idString.replaceAll('.', '/') )
            }else{
                let code = idString.charCodeAt(0);
                if(code>=65 && code <=90){
                    if(isImporter){
                        file = this.compiler.resolveManager.resolveFile(idString)
                    }else if(this.file){
                        file = this.compiler.resolveManager.resolveFile(idString, this.file)
                    }
                }
            }
            if(file){
                const compilation = await this.createChildCompilation(file, null, id);
                if(compilation && compilation !== this){
                    if(!compilation.parserDoneFlag){
                        this.loadDependencies.add(compilation);
                    }
                    type = compilation.namespace.get(id) || Namespace.globals.get(id);
                }
            }
        }

        if(!type){
            id = await this.loadManifest(id, ns);
            if(id){
                type = Namespace.globals.get(id);
            }
        }

        return this.getTypeValue(type);
    }

    checkNeedToLoadTypeById(id, context){
        if( this.hasModuleById(id, context) ){
            return false;
        }
        if( this.hasManifestResource(id, context) ){
            return true;
        }
        if(!this.isDescriptorDocument()){
            id = String(id);
            if(id.includes('.')){
                return !!this.compiler.resolveManager.resolveFile(id.replaceAll('.', '/'))
            }else{
                return !!this.compiler.resolveManager.resolveFile(id, this.file)
            }
        }
        return false;
    }

    hasManifestResource(id, context){
        let ns = this.namespace;
        if( context ){
            if(context.isNamespace){
                ns = context;
            }else if( context.isModule ){
                ns = context.namespace;
            }
        }
        id = this.compiler.manifester.resolveId(id, ns);
        return this.compiler.manifester.hasResource(id);
    }

    async loadManifest(id, ns=null, isModule=false){
        if(!isModule){
            if(ns){
                id = this.compiler.manifester.resolveId(id, ns);
            }
            if(Namespace.globals.has(id))return id;
        }
        const manifestInfo = this.compiler.manifester.getFileinfo(id, true, isModule);
        if(manifestInfo && !manifestInfo._loaded){
            await Promise.allSettled(manifestInfo.files.map(async file=>{
                const compilation = await this.compiler.createCompilation(file, null, true, false, this);
                if(compilation){
                    compilation.import = 'manifest';
                    compilation.pluginScopes.scope = manifestInfo.scope;
                    compilation.pluginScopes.inherits = manifestInfo.inherits;
                    compilation.createStack();
                    this.loadDependencies.add(compilation);
                }
            }));
            manifestInfo._loaded = true;
            return id;
        }
        return null;
    }

    parseModuleIdByFile(file){
        file = this.compiler.resolveManager.resolveFile(file, this.file);
        if( file ){
            const ns = this.compiler.getFileNamespace(file);
            const name = this.compiler.getFileClassName(file);
            return ns ? `${ns}.${name}` : name;
        }else{
            return null;
        }
    }
    
    getAllModulesByPolicy( policy ){
        const modules = [];
        this.modules.forEach( module=>{
            if( this.isPolicy(policy,module) ){
                modules.push(module);
            }
        });
        this.children.forEach( childCompilation=>{
            const result = childCompilation.getModulesByPolicy(policy);
            for( const item of result ){
                modules.push(item);
            }
        });
        return modules;
    }

    getModulesByPolicy( policy ){
        const modules = [];
        this.modules.forEach( module=>{
            if( this.isPolicy(policy,module) ){
                modules.push(module);
            }
        });
        this.children.forEach( childCompilation=>{
            childCompilation.modules.forEach( module=>{
                if( childCompilation.isPolicy(policy,module) ){
                    modules.push(module);
                }
            });
        });
        return modules;
    }

    getServerCompilations( explicit=false ){
        const compilations = [];
        const map = new WeakSet();
        const push = (compilation)=>{
            if( !map.has(compilation) ){
                map.add( compilation );
                compilations.push(compilation);
            }
        }
        this.modules.forEach( module=>{
            if( this.isServerPolicy(module, explicit) ){
                push(module.compilation);
            }
        });
        this.children.forEach( child=>{
            child.getServerCompilations(explicit).forEach( compilation=>{
                push( compilation );
            });
        });
        return compilations;
    }

    getClientCompilations( explicit=false ){
        const compilations = [];
        const map = new WeakSet();
        const push = (compilation)=>{
            if( !map.has(compilation) ){
                map.add( compilation );
                compilations.push(compilation);
            }
        }
        this.modules.forEach( module=>{
            if( this.isClientPolicy(module, explicit) ){
                push(module.compilation);
            }
        });
        this.children.forEach( child=>{
            child.getClientCompilations(explicit).forEach( compilation=>{
                push( compilation );
            });
        });
        return compilations;
    }

    readSibling(flag=false, context=''){
        const dir = this.file && path.dirname(this.file)
        if( dir ){
            const files = (Utils.readdir(path.join(dir,context.replace('.','/')), true) || []).map( filename=>{
                const stat = fs.statSync(filename);
                const folder = stat ? stat.isDirectory() : false;
                const name = path.basename(filename, this.compiler.suffix);
                return {name,folder,filename};
            });
            if( flag ){
                const uniqueNs = new Set();
                Array.from(this.modules.values()).forEach( module=>{
                    uniqueNs.add( module.namespace );
                });
                const list = [];
                uniqueNs.forEach( ns=>{
                    files.forEach( item=>{
                        item.name = ns.getChain().concat(item.name).join(".");
                        list.push( item );
                    })
                });
                return list;
            }
            return files;
        }
        return [];
    }

    parseAst(source){
        try{
            const matchedResult = source.matchAll(PARSER_TAG_REGEXP);
            if(matchedResult){
                const references = new Set();
                for(let result of matchedResult){
                    const [,name,attrs] = result;
                    const props = attrs.matchAll(PARSER_TAG_ATTR_REGEXP);
                    if(props){
                        const data = {};
                        for(let item of props){
                            let [,key,,value] = item;
                            data[key.trim()] = value.trim();
                        }
                        if(name==='scope'){
                            if(data.name){
                                this.pluginScopes.scope = data.name
                            }
                            if(data.inherits){
                                const inherits = this.pluginScopes.inherits || (this.pluginScopes.inherits=[]);
                                const items = data.inherits.split(',').map( val=>val.trim() );
                                inherits.push(...items);
                            }
                        }else if(name==='reference' && data.file){
                            this.readReferenceFiles(references, data.file, this.file);
                        }
                    }
                }
                if(references.size>0){
                    this.hookAsync('compilation.create.before', async()=>{
                        const context = this.file;
                        const files = Array.from(references).map(file=>this.createChildCompilation(file, context));
                        const items = await Promise.allSettled(files);
                        await this.compiler.callAsyncSequence(items, async(result)=>{
                            const compilation = result.value;
                            if(!compilation)return null;
                            if(!compilation.import)compilation.import = 'reference';
                            await compilation.createCompleted();
                        });
                    });
                }
            }
            const options = this.compiler.options;
            if(options.enableComments){
                this.emitComments = [];
                options.parser.onComment=(block, text, start, end, startLoc, endLoc)=>{
                    this.emitComments.push({
                        type: block ? "Block" : "Line",
                        value: text,
                        start: start,
                        end: end,
                        startLoc,
                        endLoc
                    });
                };
            }
            options.parser.onErrorCallback=(message, line, column, pos)=>{
                const loc = {line, column}
                const error = new Diagnostic(this.file, message, new Range(loc,loc) , Diagnostic.ERROR, null, 5100);
                if(this.compiler.options.diagnose){
                    this.errors.push(error);
                    this.compiler.errors.push( error );
                }else if( !this.compiler.options.debug ){
                    Utils.error(error.toString()); 
                }
            }
            return Parser.Parser.parse(source,options.parser);
        }catch(e){
            this.compiler.printLogInfo(`Error: ${e.message} \n ${e.stack} \n by ${this.file}`, 'parseAst')
            if(this.compiler.options.throwParseError){
                console.error(e);
                console.error(this.file)
            }
            this.error(e,1085);
        }
    }

    readReferenceFiles(dataset, file, context){
        file = this.compiler.resolveManager.resovleDependency(file, context);
        dataset = dataset || new Set();
        if(!file)return dataset;
        if(fs.existsSync(file)){
            const stat = fs.statSync(file)
            if(stat.isDirectory()){
                const list = Utils.readdir(file);
                if( list ){
                    list.forEach( filename=>{
                        this.readReferenceFiles(dataset, filename, file)
                    });
                }
            }else if(stat.isFile() && this.compiler.isDescriptorFile(file)){
                dataset.add(file);
            }
        }
        return dataset;
    }

    createAst(source){
        if( !this.ast ){
            this.mtime = this.file ? fs.statSync(this.file).mtimeMs : null;
            this.source = (source || fs.readFileSync(this.file, 'utf-8')).toString();
            this.compiler.markMemoryUsage(this);
            this.ast =this.parseAst( this.source );
            const info = this.compiler.getMemoryUsage(this)
            this.compiler.printLogInfo(`CreateAst: ${this.file} (${info.current} MB, total:${info.total} MB)`, 'compilation')
        }
        return this.ast;
    }

    createModule(namespace, id, isInternal = false, isStructModule=false){
        let name = id;
        let module = null;
        if( !namespace ){
            namespace = this.namespace;
        }
        if( namespace.has(id) ){
            module = namespace.get(id);
        }else if( namespace !== Namespace.dataset ) {
            name = namespace.getChain().concat(name).join('.');
        }
        
        if( module && module.namespace !== namespace ){
            module = null;
        }
        
        if( !module ){
            module = new Module(this); 
            module.id = id;
            module.file = this.file;
            module.fullname = name
            module.namespace = namespace;
            if( namespace ){
                namespace.set(id,module);
            }
            if( !isStructModule ){
                this.modules.set(name,module);
            }
            this.compiler.dispatcher('onCreatedModule',module);
        }else{
            if(!isStructModule){
                this.modules.set(name,module);
            }
        }

        if(!this.isDescriptorDocument()){
            this.compiler.printLogInfo(`createModule: ${name} -> ${!!module}, ${this.file}`, 'compilation')
        }
        if(!module.files.includes(this.file)){
            module.files.push(this.file);
        }
        module.policy = this.policy;
        module.isValid = true;
        module.mtime = this.mtime;
        return module;
    }

    createPureModule(id){
        let module = new Module(this); 
        module.namespace = Namespace.dataset;
        module.id = id;
        module.file = this.file;
        module.fullname = id
        if(!module.files.includes(this.file)){
            module.files.push(this.file);
        }
        module.policy = this.policy;
        module.isValid = true;
        module.mtime = this.mtime;
        this.compiler.dispatcher('onCreatedModule',module);
        return module;
    }

    isValid(source=null){
        if(!this.ast)return true;
        if(this.isDestroyed)return true;
        for(let [,module] of this.modules){
            if(!module.isValid)return false;
        }
        if(source == null && this.file ){
            try{
                const mtime = fs.statSync(this.file).mtimeMs;
                if(mtime === this.mtime){
                    return true;
                }
                source = fs.readFileSync(this.file, 'utf-8').toString();
            }catch(e){
                if(!fs.existsSync(this.file)){
                    this.isDestroyed = true;
                    return true;
                }
            }
        }
        const removeblank = /[\r\n\s\t]/g;
        let astr = String(this.source).replace(removeblank, '');
        let bstr = String(source).replace(removeblank, '');
        if(astr.charCodeAt(0) === 0xFEFF)astr = astr.slice(1);
        if(bstr.charCodeAt(0) === 0xFEFF)bstr = astr.slice(1);
        return astr === bstr;
    }

    destory(){
        this.scope=null;
        this.errors = null;
        this.namespaceSets = null;
        this.assets = null;
        this.requires = null;
        this.modules = null;
        this.stacks = null;
        this.dependencies = null;
        this.dependencyCompilations = null;
        this[symbolKey] = null;
        this.stack = null;
        this.ast = null;
        this.referenceStacks = null;
        this.jsxStyles = null;
        this.jsxElements = null;
        delete this.scope;
        delete this.errors;
        delete this.namespaceSets;
        delete this.assets;
        delete this.requires;
        delete this.modules;
        delete this.stacks;
        delete this.dependencies;
        delete this.dependencyCompilations;
        delete this[symbolKey];
        delete this.stack;
        delete this.ast;
        delete this.referenceStacks;
        delete this.jsxStyles;
        delete this.jsxElements;
        this.hasDeclareJSModule = false;
        this.isDestroyed = true;
        this.dispatcher('onDestory');
    }

    clear(){

        this.compiler.printLogInfo(`clear: ${this.file}`, 'compilation')

        this.modules.forEach((module)=>{
            module.clear(this);
        });

        this.errors.forEach( error=>{
            const index = this.compiler.errors.indexOf(error);
            if( index>= 0 ){
                this.compiler.errors.splice(index,1);
            }
        });

        this.assets = new Map();
        this.requires = new Map();
        this.modules = new Map();
        this.importModules = new Map();
        this.importModuleNameds = new Map();
        this.stacks = new Map();
        this.dependencies = new Set();
        this.dependencyCompilations = new Set();
        this.loadDependencies= new Set();

        this.JSX = false;
        this.hasDeclareJSModule = false;
        this.stackCreating = false;
        this.namespaceSets.forEach( namespace=>namespace.clear(this) );

        this.children.length = 0;
        this.emitComments.length = 0;
        this.jsxStyles.length = 0;
        this.jsxElements.length = 0;

        this.namespace = Namespace.dataset;
        this.referenceStacks.forEach( stack=>{
            const useRefItems = stack._useRefItems;
            if(useRefItems){
                Array.from(useRefItems.values()).forEach( stack=>{
                    if(stack.compilation === this){
                        useRefItems.delete(stack);
                    }
                });
            }
        });
        this.referenceStacks= new Set();

        const data = this[symbolKey] = {};
        data.completed={};
        data.policy = Constant.POLICY_NONE;
        data.hooks = {};
        data.waiting = [];
        data.parserDoneFlag = false;
        data.createCompletedFlag = false;
        data.descriptorReferences = null;
        data.cacheKey = Date.now();

        this.changed = !!(this.ast && this.stack);
        this.errors = [];
        this.stack  = null;
        this.ast    = null;
        this.hasParsed = false;
        this.hasChecked = false;
        this.hasFreezed = false;
        this.scope  = new TopScope(null);
        
        this.compiler.dispatcher('onChanged', this);
        this.compiler.printLogInfo(`[dispatcher] onChanged: ${this.file}`, 'compilation')
        this.dispatcher('onClear');
        return true;
    }

    get cacheId(){
        return this[symbolKey].cacheKey;
    }
    
    get parserDoneFlag(){
        return this[symbolKey].parserDoneFlag;
    }

    get parseringFlag(){
        return this[symbolKey].parseringFlag;
    }

    get createDoneFlag(){
        return this[symbolKey].createDoneFlag;
    }

    get refreshingFlag(){
        return this[symbolKey].refreshing;
    }

    parser(){
        throw new Error('Compilation.parser is deprecated, please use parserAsync.')
    }

    createStack(source=null, ast=null){
        try{
            if(!this.stack && !this.stackCreating){
                this.stackCreating = true;
                const old = this.ast;
                if( !ast ){
                    ast = this.createAst(source);
                }
                if( old !== ast || !this.stack ){
                    this.compiler.printLogInfo(`create-tokens: ${this.file}`, 'compilation')
                    this.namespace = Namespace.dataset;
                    this.compiler.markMemoryUsage(this)
                    this.stack = Tokens.create(this,ast,this.scope,null);
                    const info = this.compiler.getMemoryUsage(this);
                    this.compiler.printLogInfo(`CreateStack: ${this.file} (${info.current} MB, total:${info.total} MB)`, 'compilation')
                }
                this.stackCreating = false;
            }
            return this.stack;
        }catch(e){
            this.compiler.printLogInfo(`create-tokens-error: ${e.message} \n ${e.stack} \n by ${this.file}`, 'compilation')
            if(this.compiler.options.throwParseError)console.error(e);
            this.error(e,1085,e.message);
        }
    }

    throwError(e){
        console.error(e);
        this.compiler.printLogInfo(`Error: ${e.message} \n ${e.stack} \n by ${this.file}`, 'compilation')
    }

    async createCompleted(){
        if(this[symbolKey].createCompletedFlag)return;
        this[symbolKey].createCompletedFlag = true;
        const stack = this.stack;
        if(!this.isDestroyed && stack){
            this[symbolKey].createDoneFlag = false;
            this.compiler.printLogInfo(`create-tokens-body start: ${this.file}`, 'compilation')
            await this.callHookAsync('compilation.create.before');
            try{
                await stack.createCompleted();
            }catch(e){
                console.log(e)
            }
            this.dispatcher('onCreateCompleted');
            if(this.modules.size>0){
                const getOrder = (module)=>{
                    const base = module.isDeclaratorModule ? 4 : 0;
                    if( module.isClass ){
                        return 1+base;
                    }else if( module.isInterface ){
                        return 2+base;
                    }else if( module.isEnum ){
                        return 3+base;
                    }else if( module.isStructTable ){
                        return 4+base;
                    }
                    return 5+base;
                }
                let relatedness = new Set();
                let modules = Array.from( this.modules.values() );
                modules.forEach( module=>{
                    module.getStacks().forEach( stack=>{
                        if(stack.compilation !== this && stack.compilation){
                            relatedness.add(stack.compilation)
                        }
                    })
                });
                if(relatedness.size>0){
                    await Promise.allSettled( Array.from(relatedness.values()).map(child=>child.createCompleted()));
                }
                if( modules.length > 1 ){
                    modules = modules.sort((a,b)=>{
                        let a1 = getOrder(a);
                        let b1 = getOrder(b);
                        if(a1===b1)return 0;
                        return a1 < b1 ? -1 : 1;
                    });
                }
                this.mainModule = modules[0];
            }

            await this.callHookAsync('compilation.create.after');

            const dependencies = new Set(this.children);
            this.getCompilationsOfDependency().forEach( dep=>{
                if(dep !== this){
                    dependencies.add(dep)
                }
            });

            const compilations = Array.from(dependencies.values());
            compilations.sort( (a,b)=>{
                if(a.isDescriptorDocument())return -1;
                if(!b.isDescriptorDocument())return 1;
                return 0
            });

            await this.compiler.callAsyncSequence( compilations, async(child)=>{
                await child.createCompleted()
            });

            this[symbolKey].createDoneFlag = true;
            await this.callHookAsync('compilation.create.done');

            this.compiler.printLogInfo(`create-tokens-body done: ${this.file}`, 'compilation')
        }
    }

    getUnparseCompilationDependencies(dataset,cache){
        dataset = dataset || new Set();
        cache = cache || new WeakSet();
        const push = dep=>{
            if(!dep.hasParsed && dep !== this){
                dep.hasParsed = 'lock';
                if(!cache.has(dep)){
                    cache.add(dep);
                    dep.getUnparseCompilationDependencies(dataset,cache);
                }
                dataset.add(dep);
            }
        }
        this.loadDependencies.forEach(push)
        this.children.forEach(push);
        this.getCompilationsOfDependency().forEach(push);
        return dataset;
    }

    async parserAsync(source=null){
        if(!this.isDestroyed && this.hasParsed !==true ){
            this.hasParsed = true;
            this.createStack(source);
            this.compiler.markMemoryUsage(this)
            if( this.stack ){
                this[symbolKey].parserDoneFlag = false;
                this[symbolKey].parseringFlag = true;
                try{
                    await this.createCompleted();
                    this.compiler.printLogInfo(`parser-tokens-start: ${this.file}`, 'compilation')
                    this.compiler.dispatcher('onParseStart',this);
                    const dependencies = Array.from( this.getUnparseCompilationDependencies().values() );
                    dependencies.sort((a,b)=>{
                        let a1 = SortedMap[a.import] || (a.isDescriptorDocument() ? -3 : 0);
                        let b1 = SortedMap[b.import] || (b.isDescriptorDocument() ? -3 : 0);
                        return a1 - b1;
                    })
                    await Promise.allSettled(dependencies.map(child=>child.parserAsync()));
                    await this.callHookAsync('compilation.parser.before');
                    await this.stack.parserAsync();
                    await this.callHookAsync('compilation.parser.after');
                    if(this.changed && !this.refreshingFlag /*&& !this.compiler.options.service*/){
                        this.changed = false;
                        if(!this.errors.some( error=>error.kind === Diagnostic.ERROR)){
                            process.nextTick(()=>{
                                this.refresh()
                            })
                        }
                    }
                }catch(e){
                    this.compiler.printLogInfo(`parser-tokens-error: ${e.message} \n ${e.stack} \n by ${this.file}`, 'compilation')
                }finally{
                    this[symbolKey].parserDoneFlag = true;
                    this[symbolKey].parseringFlag = false;
                    this.compiler.dispatcher('onParseDone',this);
                    this.dispatcher('onParseDone');
                    const info = this.compiler.getMemoryUsage(this)
                    this.compiler.printLogInfo(`parser-tokens-done: ${this.file} (${info.current} MB, total:${info.total} MB)`, 'compilation')
                }
            }
        }
    }

    async refresh(){
        const dataset = new Set();
        const cache = new WeakSet();
        const dependences = this.getCompilationsOfDependency()
        const getAll = (compilation)=>{
            if(cache.has(compilation))return;
            cache.add(compilation);
            compilation.referenceCompilations.forEach( (dep)=>{
                if(!dep.isDescriptorDocument() && dep !== this){
                    if(!dependences.has(dep)){
                        if(dep.getCompilationsOfDependency().has(this)){
                            dataset.add(dep)
                        }
                    }
                }
                getAll(dep)
            })
        }
        getAll(this);
        const compilations = Array.from(dataset.values());

        const files = compilations.map(com=>com.file);
        this.compiler.printLogInfo(`refresh-relation-start: ${this.file} -> ${files.join('\n')} `, 'compilation')
        const errors = this.compiler.errors;
        const totalErrors = errors.length;
        const effect = this.compiler.options.checker.effect;
        if(errors.length>0 || this.isDestroyed || effect){
            this.compiler.printLogInfo(`show-errors: ${errors.map( err=>err.toString()).join('\n')}`, 'compilation')
            await this.compiler.callAsyncSequence(compilations, async com=>{
                if(com[symbolKey].refreshing)return;
                com[symbolKey].refreshing=true;
                await com.flush(this.isDestroyed||effect);
                com[symbolKey].refreshing=false;
            })
        }
        this.compiler.printLogInfo(`refresh-relation-done: ${this.file} errors: before ${totalErrors}, after:${errors.length}`, 'compilation')
    }

    async flush(force=false){
        if(!this.stack)return false;
        const len = this.errors.length;
        if(len>0 || force){
            const errors = this.compiler.errors;
            this.errors.forEach( error=>{
                const index = errors.indexOf(error);
                if(index>= 0){
                    errors.splice(index,1);
                }
            });
            this.errors.length = 0;
            await this.parseStack();
            this.compiler.printLogInfo(`flush: ${this.file} errors: before ${len}, after:${this.errors.length}`, 'compilation')
            this.compiler.dispatcher('onFlush', this);
            return true;
        }else{
            this.compiler.printLogInfo(`flush: ${this.file} (no errors)`, 'compilation')
            return false;
        }
    }

    async parseStack(){
        if(!this.stack)return;
        this[symbolKey].cacheKey = Date.now();
        this.dispatcher('clear-cache');
        await this.callHookAsync('compilation.flush.parse.before');
        await this.stack.parserAsync();
    }

    checker(){
        if( !this.hasChecked ){
            this.hasChecked = true;
            if( this.stack ){
                this.children.forEach( child=>child.checker() );
                this.stack.checker();
            }
        }
    }

    freeze(){
        if( !this.hasFreezed ){
            this.hasFreezed = true;
            if( this.stack && this.compiler.options.freeze ){
                //Object.freeze(this);
                this.stack.freeze();
                this.children.forEach( child=>child.freeze() );
            }
        }
    }

    async batch( plugins, completed ){
        var task = plugins.length;
        const errors = [];
        plugins.forEach((plugin)=>{
            process.nextTick((plugin)=>{
                const done = (error)=>{
                    task--;
                    if(error){
                        errors.push(error);
                    }
                    if( task < 1 ){
                        if( completed && typeof completed==="function"){
                            completed( errors.length > 0 ? errors : null, this, plugins); 
                        }
                    }
                };
                this.build(plugin,done,true);
            },plugin);
        });
    }

    async build(plugin, completed, flag=false){
        
        if( typeof completed === 'function' ){
            this[symbolKey].waitCallback.push( completed );
        }
        
        if(!this[symbolKey].building){

            this[symbolKey].building = true;
            const compilation = this;
            const done = (error,builder)=>{
                this[symbolKey].building = false;
                this.compiler.dispatcher('onBuildDone', {error,plugin,builder,compilation});
                let callback = null;
                while( callback = this[symbolKey].waitCallback.shift() ){
                    if( error && error instanceof Error ){
                        callback(error,this,plugin,builder);
                    }else{
                        callback(null,this,plugin,builder);
                    }
                }
            };
            
            try{
                await this.parserAsync();
                if( this.stack ){
                    this.compiler.dispatcher('onBuildStart',{plugin,compilation});
                    if( flag===true ){
                        plugin.start(this, done);
                    }else{
                        plugin.build(this, done);
                    }
                }else{
                    done( new Error('Parser error. no stack.') );
                }
            }catch(error){
                done(error);
            }
        }
    }

    ready(){
        return new Promise( (resolve, reject)=>{
            const execute = async()=>{
                let waitings = this._readyWaitings || (this._readyWaitings=[]);
                if(this._readying){
                    waitings.push([resolve, reject])
                }else{
                    const queues = TaskCache.queues;
                    const next = async (error)=>{
                        this._readying = false;
                        while(waitings.length>0){
                            let [_resolve, _reject] = waitings.shift();
                            if(error){
                                this.compiler.printLogInfo(`ready-execute-completed: error -> ${error.message} \n ${error.stack} \n by ${this.file}`, 'compilation')
                                _reject(error);
                            }else{
                                this.compiler.printLogInfo(`ready-execute-completed: ${this.file}`, 'compilation')
                                _resolve(this);
                            }
                        }
                        if(queues.length>0){
                            const task = queues.shift();
                            await task();
                        }else{
                            TaskCache.waiting = false;
                            process.nextTick(()=>{
                                if(!TaskCache.waiting){
                                    this.compiler.dispatcher('onIdle');
                                }
                            })
                        }
                    }
                    const processor = async()=>{
                        this._readying = true;
                        let error = null;
                        try{
                            if(!this.compiler.options.service){
                                if(!this.isValid() || this.errors.some( error=>error.kind === Diagnostic.ERROR)){
                                    this.clear();
                                }
                            }
                            if(!this.parserDoneFlag){
                                await this.parserAsync();
                            }
                            resolve(this);
                        }catch(e){
                            this.compiler.printLogInfo(`ready-execute-error: ${e.message} \n ${e.stack} \n by ${this.file}`, 'compilation')
                            reject(error=e);
                        }finally{
                            await next(error);
                        }
                    }
                    queues.push(processor);
                    if(!TaskCache.waiting){
                        TaskCache.waiting = true;
                        const task = queues.shift();
                        await task();
                    }
                }
            }
            if(this.compiler.restartuping){
                this.compiler.printLogInfo(`restartuping: ${this.file}`, 'compilation')
                this.compiler.once('onRestartupDone',execute);
            }else{
                execute()
            }
        });
    }

}

const TaskCache = {
    queues:[],
    waiting:false
};


module.exports = Compilation;