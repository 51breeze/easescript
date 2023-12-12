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
//const moduleStacks = new Map();
const symbolKey = Symbol('key');
class Compilation extends EventDispatcher{

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
        this.import ='import';
        this.dependencies=new Set();
        this.assets = new Map();
        this.requires = new Map();
        this.originId = null;
        this.originFile = null;
        this.source = '';
        this.JSX = false;
        this.stackCreating=false;
        this.createCompletedFlag = false;
        this.internalDeclared = new Map();
        this.mainModule = null;
        this[symbolKey]={
            policy:Constant.POLICY_NONE,
            building:false,
            waitCallback:[],
            completed:{},
            hooks:{},
            parserDoneFlag:false
        };
        this.jsxStyles = [];
        this.pluginScopes = Object.create(null);
        this.referenceStacks = new Set();
        this.namespace = Namespace.dataset;
    }

    hookAsync(name, callback){
        const hooks = this[symbolKey].hooks;
        const items = hooks[name] || (hooks[name]=[])
        items.push(callback);
    }

    async callHookAsync(name){
        const hooks = this[symbolKey].hooks;
        const queues = hooks[name] || (hooks[name]=[])
        try{
            //await this.compiler.callSequential( queues.splice(0, queues.length) );
            const items = queues.splice(0, queues.length);
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
        let pattern = this.compiler.options.describePattern;
        if( !pattern ){
            pattern = /(\.d\.es)$/;
        }
        if( this.file ){
            const result = pattern.test(this.file);
            if( isGlobal && this.pluginScopes.scope !== 'global' ){
                return false;
            }
            return result;
        }
        return false;
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

    checkDescriptor(descriptor, document){
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
            if( module ){
                module.isModule && module.addDepend(dep);
            }else{
                dep.used = true;
                this.dependencies.add(dep);
            }
        }
    }

    addAsset(resolve,file,content,type,assign){
        if( !this.assets.has(resolve) ){
            this.assets.set(resolve, {file,resolve,content,type,assign,id:null} );
            return true;
        }
        return false;
    }

    addRequire(key,name,from,resolve,extract,stack){
        if( !this.requires.has(name) ){
            this.requires.set(name,{key,name,from,resolve,extract,stack,id:null});
            return true;
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
        const dataset = new Set();
        this.modules.forEach( module=>{
            module.dependencies.forEach( depModule=>{
                const compil = depModule.compilation;
                if( compil ){
                    dataset.add( compil );
                }
            });
        });
        this.dependencies.forEach( depModule=>{
            const compil = depModule.compilation || depModule;
            if( !compil.isModule && compil instanceof Compilation){
                dataset.add( compil );
            }
        });
        return dataset;
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

    error(node,code,...args){
        const range = this.getRangeByNode( node );
        const message = Diagnostic.getMessage(this.compiler.options.lang,code,args);
        const error = new Diagnostic(this.file, message, range , 0, node, code);
        if( this.compiler.options.debug ){
            Utils.debug( '[Error] '+error.toString() );
            if( node instanceof Error){
                console.log( node )
            }
        }
        if(this.compiler.options.diagnose){
            this.errors.push(error);
            this.compiler.errors.push( error );
        }else if( !this.compiler.options.debug ){
            Utils.error( '[Error] '+error.toString() ); 
        }
    }

    warn(node,code,...args){
        const range = this.getRangeByNode(node);
        const message = Diagnostic.getMessage(this.compiler.options.lang,code,args);
        const warn = new Diagnostic(this.file, message, range , 1, node,code);
        if( this.compiler.options.debug ){
            Utils.debug( '[Warn] '+warn.toString() ); 
            if( node instanceof Error){
                console.log( node )
            } 
        }
        if( this.compiler.options.diagnose ){
            this.errors.push( warn );
            this.compiler.errors.push( warn );
        }else if( !this.compiler.options.debug ){
            Utils.warn( '[Warn] '+warn.toString() ); 
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

    getTypeValue(type){
        if( type && !type.isType && type.isStack ){
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
        if(compilation && !compilation.stack && !this.stackCreating){
            compilation.originId = originId || file;
            Object.assign(compilation.pluginScopes,this.pluginScopes);
            compilation.createStack();
        }
        return compilation;
    }

    hasModuleById(id, context){
        if(String(id).includes('.')){
            return Namespace.globals.has(id);
        }
        let scope = this.scope;
        if(context && context.isNamespace){
            if( context.has(id) ){
                return true
            }
        }else if(context && context.isModule ){
            if(context.imports.has(id) || context.namespace.has(id)){
                return true;
            }else if(context.moduleStack && context.moduleStack.parentStack){
                scope = context.moduleStack.parentStack.scope;
            }
        }
        if(scope.isDefine(id)){
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

    getModuleById(id, context, flag=false){
        if(String(id).includes('.')){
            return this.getTypeValue(Namespace.globals.get(id)||null);
        }

        let scope = this.scope;
        if(context && context.isNamespace){
            if( context.has(id) ){
                return this.getTypeValue(context.get(id));
            }
        }else if( context && context.isModule ){
            const result = context.getImport(id) || context.namespace.get(id);
            if( result ){
                const aliasName = context.importAlias.get(result);
                if(aliasName && aliasName!==id){
                    return flag ? false : null;
                }
                return this.getTypeValue(result);
            }else if(context.moduleStack && context.moduleStack.parentStack){
                scope = context.moduleStack.parentStack.scope;
            }
        }

        const type = scope.define(id);
        if(type){
            return this.getTypeValue(type);
        }

        if(this.modules.has(id)){
            return this.getTypeValue(this.modules.get(id));
        }
        if(Namespace.globals.has(id)){
            return this.getTypeValue(Namespace.globals.get(id));
        }
        return null;
    }

    async loadTypeAsync(id, context, isImporter=false){
        let type = this.getModuleById(id, context, true);
        if(type===false)return null;
        if(type)return type;
        let ns = this.namespace;
        if( context ){
            if(context.isNamespace){
                ns = context;
            }else if( context.isModule ){
                ns = context.namespace;
            }
        }

        let idString = String(id);
        let file = null;
        if( idString.includes('.') ){
            file = path.resolve(this.compiler.workspace, idString.replaceAll('.', path.sep) );
        }else{
            if(isImporter){
                file = path.resolve(this.compiler.workspace, idString);
            }else{
                file = path.resolve(this.file ? path.dirname(this.file) : this.compiler.workspace, idString);
                if(this.file && !fs.existsSync(file+this.compiler.suffix)){
                    file = path.resolve(this.compiler.workspace, idString);
                }
            }
        }

        const compilation = await this.createChildCompilation(file, null, id);
        if(compilation){
            type = compilation.namespace.get(id) || Namespace.globals.get(id);
        }

        if(!type){
            type = await this.loadManifest(id, ns);
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
        id = String(id);
        if(this.file && !id.includes('.') && fs.existsSync(path.join(path.dirname(this.file), id+this.compiler.suffix))){
            return true;
        }
        return fs.existsSync(path.join(this.compiler.workspace,id.replaceAll('.', path.sep)+this.compiler.suffix))
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

    async loadManifest(id, ns){
        id = this.compiler.manifester.resolveId(id, ns);
        if(Namespace.globals.has(id))return Namespace.globals.get(id);
        const manifestInfo = this.compiler.manifester.getFileinfo(id, true);
        if(manifestInfo && !manifestInfo._loaded){
            await Promise.allSettled(manifestInfo.files.map(async file=>{
                const compilation = await this.compiler.createCompilation(file, null, true, false, this);
                if(compilation){
                    compilation.import = 'manifest';
                    compilation.pluginScopes.scope = manifestInfo.scope;
                    compilation.pluginScopes.inherits = manifestInfo.inherits;
                    compilation.createStack();
                }
            }));
            manifestInfo._loaded = true;
            return Namespace.globals.get(id);
        }
        return null;
    }

    parseModuleIdByFile(file){
        file = this.compiler.getFileAbsolute(file, this.file && path.dirname(this.file) );
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

    parseAst( source ){
        try{
            source.replace(/^([\s\r\n]+)?\/\/\/<scope\s+(.*?)\/\>/i, (all, _, matched)=>{
                matched.replace(/\b(name|inherits)[\s+]?=[\s+]?(['"])(.*?)\2/g, (all, props, _, value)=>{
                    if( props==='inherits' ){
                        const inherits = this.pluginScopes.inherits || (this.pluginScopes.inherits=[]);
                        inherits.push( value.trim() )
                    }else if(props==='name'){
                        this.pluginScopes.scope = value
                    }
                });
                return all;
            });
            return Parser.Parser.parse(source,this.compiler.options.parser);
        }catch(e){
            this.error(e,1085,e.message);
        }
    }

    createAst(source){
        if( !this.ast ){
            try{
                this.mtime = this.file ? fs.statSync(this.file).mtimeMs : null;
                this.source = (source || fs.readFileSync(this.file)).toString();
                this.ast =this.parseAst( this.source );
            }catch(e){
                this.error(e,1085,e.message);
            }
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
            this.compiler.dispatcher('onCreatedModule',module);
        }

        module.file = this.file;
        module.files.push(this.file);
        module.policy = this.policy;
        module.isValid = true;
        module.mtime = this.mtime;

        if( namespace ){
            namespace.set(id,module);
        }
        if( !isStructModule ){
            this.modules.set(name,module);
        }
        return module;
    }

    isValid(source){
        if( !this.ast )return false;
        if( source === void 0 && this.file ){
            const mtime = fs.statSync(this.file).mtimeMs;
            if( mtime === this.mtime ){
                return true;
            }
        }else if( source && source === this.source ){
            return true;
        }
        return false;
    }

    clear( destroy=false ){
        this.modules.forEach((module)=>{
            // if( module.compilation === this ){
            //     moduleStacks.delete(module);
            // }
            module.clear( this );
        });
        
        this.errors.forEach( error=>{
            const index = this.compiler.errors.indexOf(error);
            if( index>= 0 ){
                this.compiler.errors.splice(index,1);
            }
        });

        this.assets.clear();
        this.requires.clear();
        this.modules.clear();
        this.stacks.clear();
        this.dependencies.clear();
        this.internalDeclared.clear();
        this.children = [];
        this.JSX = false;
        this.stackCreating = false;
        this.namespaceSets.forEach( namespace=>namespace.clear(this) );
        this.jsxStyles = [];

        this.referenceStacks.forEach( stack=>{
            const useRefItems = stack._useRefItems;
            if( useRefItems ){
                Array.from(useRefItems.values()).forEach( stack=>{
                    if( stack.compilation === this ){
                        useRefItems.delete(stack);
                    }
                });
            }
        });

        if( destroy ){
            delete this.scope;
            delete this.errors;
            delete this.namespaceSets;
            delete this.assets;
            delete this.requires;
            delete this.modules;
            delete this.stacks;
            delete this.dependencies;
            delete this.internalDeclared;
            this[symbolKey] = {};
            delete this.stack;
            delete this.ast;
            delete this.referenceStacks;
            this.dispatcher('onCompilationDestory', this);
        }else{
            const data = this[symbolKey];
            data.completed={};
            data.policy = Constant.POLICY_NONE;
            data.hooks = {};
            data.parserDoneFlag = false;
            data.createCompletedFlag = false;
            this.changed = !!this.ast;
            this.errors = [];
            this.stack  = null;
            this.ast    = null;
            this.hasParsed = false;
            this.hasChecked = false;
            this.hasFreezed = false;
            this.scope  = new TopScope(null);
            this.referenceStacks.clear();
            this.dispatcher('onCompilationReset', this);
        }
        return true;
    }

    get parserDoneFlag(){
        return this[symbolKey].parserDoneFlag;
    }

    parser(){
        throw new Error('Compilation.parser is deprecated, please use parserAsync.')
    }

    createStack(source=null, ast=null){
        if(!this.stack && !this.stackCreating){
            this.stackCreating = true;
            const old = this.ast;
            if( !ast ){
                ast = this.createAst(source);
            }
            if( old !== ast ){
                this.stack = Tokens.create(this,ast,this.scope,null);
            }
            this.stackCreating = false;
        }
        return this.stack;
    }

    async createCompleted(){
        if(this[symbolKey].createCompletedFlag)return;
        this[symbolKey].createCompletedFlag = true;
        const stack = this.stack;
        if( stack ){
            this[symbolKey].createDoneFlag = false;
            await this.callHookAsync('compilation.create.before');
            await stack.createCompleted();
            const getOrder = (module)=>{
                const base = module.isDeclaratorModule ? 4 : 0;
                if( module.isClass ){
                    return 1+base;
                }else if( module.isInterface ){
                    return 2+base;
                }else if( module.isEnum ){
                    return 3+base;
                }else if( module.isStructTableDeclaration ){
                    return 4+base;
                }
                return 5+base;
            }
            let modules = Array.from( this.modules.values() );
            if( modules.length > 1 ){
                modules = modules.sort((a,b)=>{
                    let a1 = getOrder(a);
                    let b1 = getOrder(b);
                    if(a1===b1)return 0;
                    return a1 < b1 ? -1 : 1;
                });
            }
            this.mainModule = modules[0];
            this[symbolKey].createDoneFlag = true;
            await this.callHookAsync('compilation.create.after');
            await Promise.allSettled(this.children.map(child=>child.createCompleted()));
        }else{
            throw new Error('Compilation.createCompleted failed. ast is not created.');
        }
    }

    async parserAsync(source){
        if( !this.hasParsed ){
            this.hasParsed = true;
            this.createStack(source);
            if( this.stack ){
                this[symbolKey].parserDoneFlag = false;
                this.compiler.dispatcher('onParseStart',{compilation:this});
                await this.createCompleted();
                await this.callHookAsync('compilation.parser.before');
                await Promise.allSettled(this.children.map(child=>child.parserAsync()))
                await this.stack.parserAsync();
                await this.callHookAsync('compilation.parser.after');
                this[symbolKey].parserDoneFlag = true;
                this.compiler.dispatcher('onParseDone',{compilation:this});
            }
        }
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

    async ready(callback){
        await this.parserAsync();
        if( typeof callback==='function'){
            callback();
        }
    }

}
module.exports = Compilation;