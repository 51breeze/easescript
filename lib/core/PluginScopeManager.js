const merge  = require("lodash/merge");

const defaultConfigs=[

    {
		name:"es-vue",
		include:/\w/,
		exclude:/\w/,
        inherits:[],
		onlyonce:false
	}
]

class PluginScopeManager{

    constructor(compiler){
        this.compiler = compiler;
        this.configItems = [];
        this.configMaps = {};
        this.relationMaps = {};
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
        clear(this.relationMaps);
    }

    reset(){
        this.clear();
        this.initConfig();
    }

    initConfig(){
        const configs = this.compiler.options.scopes || [];
        const configMaps= this.configMaps;
        const inheritMaps = this.relationMaps;
        configs.forEach( config=>{
            configMaps[config.name] = config;
            if( Array.isArray(config.inherits) ){
                config.inherits.forEach( name=>{
                    if( !inheritMaps[name] ){
                        inheritMaps[name] = config.name;
                    }
                })
            }
        });
        this.configItems.push( ...configs );
        const plugins = this.compiler.options.plugins||[];
        plugins.forEach( plugin=>{
            if( plugin && plugin.options && plugin.options.context){
                const context = plugin.options.context;
                const name = (plugin.name || plugin.plugin).toString();
                if( !context.name )context.name = name;
                if( configMaps[name] ){
                    const clone = Object.assign({}, context);
                    delete clone.name;
                    merge(configMaps[name], clone);
                }else{
                    configMaps[context.name] = context;
                    this.configItems.push(context)
                }
                if( Array.isArray(context.inherits) ){
                    context.inherits.forEach( name=>{
                        if( !inheritMaps[name] ){
                            inheritMaps[name] = context.name;
                        }
                    })
                }
            }
        });
    }

    getScopesByDocument( document ){
        const scopes = []
        if(!document)return scopes;
        this.configItems.forEach( config=>{
            if( this.checkByConfig(config,document) === true ){
                scopes.push( config.name );
                if( config.inherits && Array.isArray(config.inherits) ){
                    config.inherits.forEach( name=>{
                        scopes.push( name )
                    })
                }
            }
        });
        return scopes;
    }

    getScopeName(name){
        const _name = this.relationMaps[name];
        if( _name ){
            return this.getScopeName(_name);
        }
        return name;
    }

    getConfigsByScope(name, results=[]){
        const config = this.configMaps[name];
        if(config){
            results.push(config)
        }else if( this.relationMaps[name] ){
            return this.getConfigsByScope(this.relationMaps[name], results)
        }
        return results;
    }

    checkByConfig(config, context){
        if(!context)return false;
        if( this.checkByRule(config.exclude,context.file) )return false;
        const res = this.checkByRule(config.include, context.file, null);
        if(res)return true;
        if(context.isModule){
            if(this.checkByRule(config.exclude, context.getName('/')))return false;
            if(this.checkByRule(config.include, context.getName('/')))return true;
        }
        return res;
    }

    isMatchNamedScopes(name, scopeScheme){
        if(scopeScheme.scope === name || scopeScheme.name === name)return true;
        if(scopeScheme.inherits && Array.isArray(scopeScheme.inherits) && scopeScheme.inherits.includes(name)){
            return true;
        }
        return false;
    }

    checkByScope(scope, context){
        if(!scope)return false;
        if(!context)return false;
        const compilation = context.compilation || context;
        if(!compilation)return false;
        const ctxScopes = compilation.pluginScopes;
        const origin = scope;
        if(this.isMatchNamedScopes(scope,ctxScopes))return true;
        scope = this.getScopeName(scope);
        if( scope !== origin && this.isMatchNamedScopes(scope,ctxScopes))return true;
        const includeRules = this.getConfigsByScope(scope);
        if( includeRules.length > 0 ){
            let hasSpecific = false;
            const result = includeRules.some((config)=>{
                const res = this.checkByConfig(config, context);
                if( res === true )hasSpecific = true;
                return res !== false;
            });
            if(!result)return false;
            if(hasSpecific)return true;
        }
        const excludeRules = includeRules.length > 0 ? this.configItems.filter( rule=>!includeRules.includes(rule) ) : this.configItems;
        if( excludeRules.some( config=>this.checkByRule(config.include,context.file) ) ){
            return false;
        }
        return true;
    }

    checkByDescriptor(descriptor, context, globalResult=true){
        if( this.configItems.length < 1 ){
            return true;
        }
        if(!descriptor || !descriptor.compilation)return true;
        const descScopes = descriptor.compilation.pluginScopes;
        if(descScopes.scope==='global')return globalResult;
        const current = descScopes.scope || 'local';
        const locals = [];
        if( current==='local' ){
            locals.push( ...this.getScopesByDocument( descriptor ) )
        }
        if( current==='local' ){
            return locals.length>0 ? locals.some( scope=>this.checkByScope(scope, context) ) : true;
        }
        return this.checkByScope(current, context);
    }

    checkByPlugin(plugin, context, globalResult=true){
        if( this.configItems.length < 1 ){
            return true;
        }
        if( !plugin || !context)return true;
        const compilation = context.compilation || context;
        if(!compilation)return false;
        const ctxScopes = compilation.pluginScopes || {};
        if(ctxScopes.scope==='global')return globalResult;
        if(this.isMatchNamedScopes(plugin.name, ctxScopes))return true;
        return this.checkByScope(plugin.name, context);
    }

    checkByRule(rule, value, defaultValue=false){
        if( rule ){
            if( Array.isArray(rule) && rule.length > 0){
                return rule.some( rule=>this.checkByRule(rule,value,defaultValue) );
            }else if( rule instanceof RegExp){
                return rule.test(value);
            }else if( typeof rule ==="string"){
                return rule === value;
            }
        }
        return defaultValue;
    }

}

module.exports = PluginScopeManager;