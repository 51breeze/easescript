const Utils = require("./Utils");
class ScopeManager{

    #cache = null

    constructor(compiler){
        this.compiler = compiler;
        this.configMaps = {};
        this.onlys = [];
        this.resolves = [];
        this.commons = [];
        this.configItems = [];
        this.initConfig();
    }

    clear(){
        this.configItems.splice(0,this.configItems.length);
        const clear = (target)=>{
            Object.keys(target).forEach(key=>{
                delete target[key]
            })
        }
        clear(this.configMaps);
        this.commons.length = 0;
        this.resolves.length = 0;
        this.onlys.length = 0;
    }

    reset(){
        this.clear();
        this.initConfig();
    }

    getItem(target, name){
        return target[name] || target[name+'s']
    }

    setInherit(config){
        const inherits = this.getItem(config, 'inherit');
        if(inherits){
            if(Array.isArray(inherits)){
                config.inherits = inherits
            }else if(typeof inherits ==='string'){
                config.inherits = [inherits]
            }else{
                throw new Error('Scope config.inherit must is string or string[]')
            }
        }else{
            config.inherits = []
        }
    }

    setResolve(config){
        let resolves = this.getItem(config, 'resolve');
        if(resolves){
            if(!Array.isArray(resolves)){
                resolves = [resolves]
            }
            resolves.forEach(test=>{
                if(!test || !(test instanceof RegExp)){
                    throw new Error('Scope config.resolve must is regexp')
                }
            });
            const name = config.name;
            resolves = resolves.map( test=>{
                return {test, name}
            })
            config.resolves = resolves;
            this.resolves.push(...resolves)
        }else{
            config.resolves = [];
        }
    }

    setCommon(config){
        let commons = this.getItem(config, 'common');
        if(commons){
            if(!Array.isArray(commons)){
                commons = [commons]
            }
            commons.forEach(test=>{
                if(!test || !(test instanceof RegExp)){
                    throw new Error('Scope config.common must is regexp')
                }
            });
            config.commons = commons;
            const getKey = (item)=>{
                let g = item.global ? 'g' : '';
                let i = item.ignoreCase ? 'i' : '';
                let m = item.multiline ? 'm' : '';
                return item.source+g+i+m;
            }
            commons.forEach( item=>{
               if(!this.commons.some(old=>getKey(old) === getKey(item))){
                    this.commons.push(item)
               }
            })
        }else{
            config.commons = [];
        }
    }

    getChains(config){
        const cache = new WeakSet()
        const find = (config)=>{
            if(cache.has(config))return [];
            cache.add(config);
            const items = config.inherits.map(name=>{
                const config = this.configMaps[name]
                if(config){
                    return find(config)
                }else{
                    return [name]
                }
            }).flat();
            items.unshift(config.name);
            return items;
        }
        return find(config);
    }

    getPluginId(pluginName){
        if(pluginName.includes('/') || pluginName.includes('\\')){
            return pluginName.split(/[\\\/]+/).pop();
        }
        return pluginName;
    }

    initConfig(){
        const configs = this.compiler.options.scopes || [];
        configs.forEach( config=>{
            if(!config.name || typeof config.name !== 'string'){
                throw new Error('Scope config rule.name must is string')
            }else{
                config = Object.create(config)
                config.name = this.getPluginId(config.name);
                this.configItems.push(config)
                this.setResolve(config)
                this.setInherit(config)
                this.setCommon(config)
                if(config.only===true){
                    this.onlys.push(config.name)
                }
                this.configMaps[config.name] = config;
            }
        });

        const plugins = this.compiler.options.plugins||[];
        plugins.forEach( plugin=>{
            if(plugin && plugin.options && plugin.options.context){
                const context = plugin.options.context;
                const name = context.name || (plugin.name || plugin.plugin).toString();
                if(!name || typeof name !== 'string'){
                    throw new Error('Scope config.name must is string')
                }else{
                    const config = Object.create(context);
                    config.name = this.getPluginId(name);
                    this.configItems.push(config)
                    this.setResolve(config)
                    this.setInherit(config)
                    this.setCommon(config)
                    if(config.only===true){
                        this.onlys.push(config.name)
                    }
                    this.configMaps[config.name] = config;
                }
            }
        });

        this.configItems.forEach( config=>{
            config.matching = this.getChains(config)
        })

        this.#cache = Object.create(null)
    }

    rule(test, file){
        if(typeof test ==='string'){
            file.includes(test)
        }else if(test instanceof RegExp){
            return test.test(file)
        }
        return test === file;
    }

    include(config, file){
        const includes = this.getItem(config, 'include');
        if(includes){
            if(Array.isArray(includes)){
                return includes.some( test=>this.rule(test, file))
            }
            return this.rule(includes, file)
        }
        return true;
    }

    exclude(config, file){
        const excludes = this.getItem(config, 'exclude');
        if(excludes){
            if(Array.isArray(excludes)){
                return excludes.some( test=>this.rule(test, file))
            }
            return this.rule(excludes, file)
        }
        return false;
    }

    getOnlyConfigs(file, exclude=null){
        return this.configItems.filter( config=>{
            if(config===exclude || !config.only)return false;
            if(this.exclude(config, file)){
                return false;
            }
            if(config.resolves.some(item=>item.test.test(file))){
                return true;
            }
            return this.include(config, file)
        });
    }

    resolveConfigs(file){
        return this.configItems.filter(config=>{
            if(this.exclude(config, file)){
                return false;
            }
            return this.include(config, file)
        })
    }

    isCommonDocumentor(file){
        return this.commons.some(item=>item.test(file))
    }

    resolveScopeName(file, defaultValue=null){
        const resolve = this.resolves.find( item=>item.test.test(file))
        return resolve ? resolve.name : defaultValue;
    }

    findConfigs(name){
        return this.configItems.filter(config=>{
           return config.name === name || config.inherits.includes(name)
        })
    }

    checkConfig(config, file){
        if(this.exclude(config, file)){
            return false
        }
        if(config.resolves.some(item=>item.test.test(file))){
            return true;
        }

        if(this.include(config, file) || config.commons.some(item=>item.test(file))){
            const others = this.getOnlyConfigs(file, config);
            return !(others.length > 0);
        }
        return false;
    }

    checkDocumentor(name, compilation, globalResult=true){
        if(Utils.isModule(compilation)){
            compilation = compilation.compilation;
        }
        if(!Utils.isCompilation(compilation))return false;
        const scope = compilation.pluginScopes
        if(!scope)return true;
        if(scope.scope==='global')return globalResult;
       
        const file = compilation.file;
        const key = name +':'+ file;
        if(Object.hasOwn(this.#cache, key)){
            return this.#cache[key]
        }
        name = this.getPluginId(name);
        const configs = this.findConfigs(name)
        if(configs.length>0){
            return this.#cache[key] = configs.some((config)=>{
                if(config.matching.includes(scope.scope)){
                    return true
                }else{
                    const inherits = this.getItem(scope, 'inherit')
                    if(inherits){
                        if(Array.isArray(inherits)){
                            if(inherits.some( name=>config.matching.includes(name))){
                                return true
                            }
                        }else if(config.matching.includes(inherits)){
                            return true
                        }
                    }
                }
                return this.checkConfig(config, file);
            })
        }else{
            const configs = this.resolveConfigs(file)
            if(configs.length>0){
                return this.#cache[key] = configs.some(config=>config.matching.includes(name));
            }
            return this.#cache[key] = true
        }
    }

    checkDescriptor(descriptor, contextCompilation, globalResult=true){
        if(!(Utils.isStack(descriptor) || Utils.isModule(descriptor)))return true;
        const ownerCompilation = descriptor.compilation;
        if(ownerCompilation === contextCompilation)return true;
        if(!Utils.isCompilation(ownerCompilation))return true;
        const scopes =ownerCompilation.pluginScopes || {};
        let scope = this.resolveScopeName(ownerCompilation.file, scopes.scope)
        if(scope==='global')return globalResult;
        if(this.isCommonDocumentor(contextCompilation.file)){
            return this.isCommonDocumentor(ownerCompilation.file)
        }
        const file = contextCompilation.file;
        const configs = this.findConfigs(scope)
        if(configs.length>0){
            return configs.some((config)=>{
                return this.checkConfig(config, file);
            })
        }else{
            const configs = this.resolveConfigs(file)
            if(configs.length>0){
                return configs.some(config=>this.checkConfig(config,ownerCompilation.file))
            }
            return true
        }
    }

    checkScope(scopeName, contextCompilation, globalResult=true){
        if(scopeName==='global')return globalResult;
        const configs = this.findConfigs(scopeName)
        if(configs.length>0){
            return configs.some((config)=>{
                return this.checkConfig(config, contextCompilation.file);
            })
        }
        return true;
    }

    checkFile(file, contextCompilation, globalResult=true){
        if(!file && typeof file !== 'string')return true;
        let scope = this.resolveScopeName(file)
        if(scope==='global')return globalResult;
        if(this.isCommonDocumentor(contextCompilation.file)){
            return this.isCommonDocumentor(file)
        }
        const configs = this.findConfigs(scope)
        if(configs.length>0){
            return configs.some((config)=>{
                return this.checkConfig(config, contextCompilation.file);
            })
        }else{
            const configs = this.resolveConfigs(contextCompilation.file)
            if(configs.length>0){
                return configs.some(config=>this.checkConfig(config,file))
            }
            return true
        }
    }
}

module.exports = ScopeManager;