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
            this.gathers = parent.gathers;
        }else{
            this.topDeclarations = new Set();
            this.gathers = Object.create(null);
        }
        this.declarations=new Map();
        this.proxyScope = null;
        this.isStatic = false;
        this._predicates=null
        this._validates=null
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

    getScopeByCallback(callback){
        const proxyScope =  this.proxyScope;
        if( proxyScope && proxyScope !== this ){
            return proxyScope.getScopeByCallback( callback );
        }
        let obj = this;
        while( obj && !callback(obj) ){
            obj = obj.parent;
        }
        return obj;
    }

    define(name, stack, noTopFlag=false){
        const proxyScope =  this.proxyScope;
        if( proxyScope && proxyScope !== this ){
            return proxyScope.define( name , stack);
        }
        if( stack === void 0 ){
            let def = this.declarations.get(name);
            if(def === this)def = null;
            if(!def){
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
            return def;
        }

        const gathers = this.gathers[name] || (this.gathers[name] = []);
        gathers.push(this);

        this.declarations.set(name,stack);
        if(!noTopFlag && this.topDeclarations ){
            this.topDeclarations.add(name);
        }
    }

    getDefine(name, context){
        const proxyScope =  this.proxyScope;
        if( proxyScope && proxyScope !== this ){
            return proxyScope.getDefine( name , context);
        }
        let def = this.declarations.get(name);
        if(def===this)def = null;
        if(!def){
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
        return def;
    }

    getKeys(context=null){
        const proxyScope =  this.proxyScope;
        if( proxyScope && proxyScope !== this ){
            return proxyScope.getKeys(context);
        }
        let keys = new Set()
        let pushKeys = (object)=>{
            object.declarations.forEach((def, name)=>{
                if(def !== object){
                    keys.add(name);
                }
            })
        }
        {
            pushKeys(this);
        }
        let parent = this.parent;
        while( parent ){
            const is =!context || context.some( name=>!!parent.type(name) );
            if(is){
                pushKeys(parent);
                parent = parent.parent;
            }else{
                break;
            }
        }
        return Array.from(keys.values());
    }

    getValues(context=null){
        const proxyScope =  this.proxyScope;
        if( proxyScope && proxyScope !== this ){
            return proxyScope.getValues(context);
        }
        let dataset = new Map()
        let push = (object)=>{
            object.declarations.forEach((def, name)=>{
                if(def !== object){
                    if(!dataset.has(name)){
                        dataset.set(name, def);
                    }
                }
            })
        }
        {
            push(this);
        }
        let parent = this.parent;
        while( parent ){
            const is =!context || context.some( name=>!!parent.type(name) );
            if(is){
                push(parent);
                parent = parent.parent;
            }else{
                break;
            }
        }
        return dataset;
    }

    checkDocumentDefineScope(name, excludes=[]){
        const gathers = this.gathers[name];
        if(gathers){
            if(excludes && excludes.length>0){
                return gathers.some(scope=>!excludes.some(name=>scope.type(name)))
            }else{
                return true;
            }
        }
        return false;
    }

    getDocumentDefineScopes(name,  excludes=[]){
        const gathers = this.gathers[name];
        if(gathers){
            if(excludes && excludes.length>0){
                return gathers.filter(scope=>!excludes.some(name=>scope.type(name)))
            }
        }
        return gathers || [];
    }

    isDefine( name, endContext ){
        let proxyScope =  this.proxyScope;
        if( proxyScope && proxyScope !== this ){
            return this.proxyScope.isDefine(name, endContext);
        }
        let parentScope = this;
        while( parentScope && parentScope instanceof Scope){
            let def = parentScope.declarations.get(name);
            if( def && parentScope !== def ){
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

    allowInsertionPredicate(){
        return this.isBlockScope || this.isTopScope || this.isFunctionScope || this.isBlankScope;
    }

    get predicates(){
        return this._predicates || (this._predicates = new Map())
    }

    get validates(){
        return this._validates || (this._validates = new Map())
    }

    setPredicate(descriptor, type){
        this.predicates.set(descriptor, type);
    }

    getPredicate(descriptor, onlyFlag=false){
        let type = this.predicates.get( descriptor );
        if( !type && !onlyFlag){
            let parentScope = this.parent;
            while(parentScope){
                if(parentScope.isClassScope || parentScope.isInterfaceScope || parentScope.isDeclaratorScope)break;
                if(parentScope.allowInsertionPredicate()){
                    type = parentScope.predicates.get( descriptor )
                    if(type)return type;
                }
                parentScope = parentScope.parent;
            }
        }
        return type || null;
    }

    getValidateState(descriptor, onlyFlag=false){
        let info = this.validates.get( descriptor );
        if( !info && !onlyFlag){
            let parentScope = this.parent;
            while(parentScope){
                if(parentScope.isClassScope || parentScope.isInterfaceScope || parentScope.isDeclaratorScope)break;
                if(parentScope.allowInsertionPredicate()){
                    info = parentScope.validates.get( descriptor )
                    if(info)return info;
                }
                parentScope = parentScope.parent;
            }
        }
        return info || null;
    }

    setValidateState(descriptor, type, value, expr){
        this.validates.set(descriptor, {type, value, expr, scope:this})
    }

};