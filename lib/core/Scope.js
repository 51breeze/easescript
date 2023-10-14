const EventDispatcher = require("./EventDispatcher.js");
const scopeParents = ['block','function','class','top'];
module.exports = class Scope extends EventDispatcher{
    constructor( parent ){
        super();
        this.parent = parent;
        this.children=[];
        this.level = 0;
        if( parent ){
            parent.children.push( this );
            this.level = parent.level+1;
            this.asyncParentScopeOf = parent.async ? parent : parent.asyncParentScopeOf;
        }
        if( parent && parent.topDeclarations ){
            this.topDeclarations = parent.topDeclarations;
        }else{
            this.topDeclarations = new Set();
        }
        this.declarations=new Map();
        this.proxyScope = null;
        this.isStatic = false;
    }
    
    removeChild( childScope ){
        const proxyScope =  this.proxyScope;
        if( proxyScope && proxyScope !== this ){
            return proxyScope.removeChild( childScope );
        }
        const index = this.children.indexOf( childScope );
        if( index >= 0 ){
            return this.children.splice(index,1);
        }
        return null;
    }

    hasChildDeclared(name){
        const proxyScope =  this.proxyScope;
        if( proxyScope && proxyScope !== this ){
            return proxyScope.hasChildDeclared( name );
        }
        const check = item=>{
            if( item.isDefine( name ) ){
                return true;
            }else{
                return item.children.some( check );
            }
        }
        return check( this );
    };

    generateVarName( name, flag=false){
        const proxyScope =  this.proxyScope;
        if( proxyScope && proxyScope !== this ){
            return proxyScope.generateVarName( name , flag);
        }
        let count = 0;
        let ref = name;
        while( this.declarations.has(ref) || (flag === false && this.topDeclarations.has(ref)) || (flag===true && this.hasChildDeclared(ref)) ){
            count++;
            ref=name+count;
        }
        this.define(ref,this);
        return ref;
    }

    type( name ){
        const proxyScope =  this.proxyScope;
        if( proxyScope && proxyScope !== this ){
            return proxyScope.type( name );
        }
        return false;
    }

    getScopeByType( name ){
        const proxyScope =  this.proxyScope;
        if( proxyScope && proxyScope !== this ){
            return proxyScope.getScopeByType( name );
        }
        let obj = this;
        while( obj && obj instanceof Scope && !obj.type( name ) ){
            obj = obj.parent;
        }
        return obj;
    }

    define(name, stack){
        const proxyScope =  this.proxyScope;
        if( proxyScope && proxyScope !== this ){
            return proxyScope.define( name , stack);
        }
        if( stack === void 0 ){
            let has = this.declarations.has( name );
            if( !has ){
                let parentScope = this.parent;
                while( parentScope && parentScope instanceof Scope ){
                    if( parentScope.declarations.has(name) ){
                        const res = parentScope.declarations.get(name);
                        return res === parentScope ? null : res;  
                    }else{
                        parentScope = parentScope.parent;
                    }
                }
                return null;
            }
            return this.declarations.get(name);
        }

        this.declarations.set(name,stack);
        if( this.topDeclarations ){
            this.topDeclarations.add(name);
        }
    }

    getDefine(name, context){
        const proxyScope =  this.proxyScope;
        if( proxyScope && proxyScope !== this ){
            return proxyScope.getDefine( name , context);
        }
        let has = this.declarations.has( name );
        if( !has ){
            let parentScope = this.parent;
            while( parentScope && parentScope instanceof Scope ){
                if( parentScope.declarations.has(name) ){
                    const res = parentScope.declarations.get(name);
                    return res === parentScope ? null : res;  
                }else{
                    if( context && (parentScope.type(context) || (context==="block" && parentScope.type("function") ) )){
                        return false;
                    }
                    parentScope = parentScope.parent;
                }
            }
            return null;
        }
        return this.declarations.get(name);
    }

    getKeys(context){
        const proxyScope =  this.proxyScope;
        if( proxyScope && proxyScope !== this ){
            return proxyScope.getKeys(context);
        }

        let keys = Array.from(this.declarations.keys());
        let parent = this.parent;
        while( parent ){
            const is =!context || context.some( name=>!!parent.type(name) );
            if( is ){
                keys = keys.concat( Array.from(parent.declarations.keys()) );
                parent = parent.parent;
            }
            break;
        }
        return keys;
    }

    isDefine( name, endContext ){
        const proxyScope =  this.proxyScope;
        if( proxyScope && proxyScope !== this ){
            return this.proxyScope.isDefine(name, endContext);
        }
        let parentScope = this;
        while( parentScope && parentScope instanceof Scope){
            if( parentScope.declarations.has(name) && parentScope !== parentScope.declarations.get(name) ){
                return true
            }else{
                if( endContext ){
                    if( parentScope.type(endContext) ){
                        return false;
                    }
                    const at = scopeParents.indexOf( endContext );
                    if( at >=0 ){
                        const scopes = scopeParents.slice(at+1);
                        if( scopes.length > 0 && scopes.some( name=>parentScope.type(name) ) ){
                            return false;
                        }
                    }
                }
                parentScope = parentScope.parent;
            }
        }
        return false;
    }
};