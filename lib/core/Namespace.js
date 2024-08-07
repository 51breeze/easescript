const AutoImporter = require("./AutoImporter");
const Utils = require("./Utils");
const Logger = require("./Logger");
const privateKey = Symbol('key');
class NamespaceGlobal{
    constructor(){
        this.globals = new Map();
    }

    getKey(name){
        return name && name.substring(0,7) === 'global.' ? name.substring(7) : name;
    }

    set(name, value){
        this.globals.set(this.getKey(name), value);
    }

    get(name){
        let key = this.getKey(name);
        let result = this.globals.get(key);
        if(!result)return null;
        if(!result.isType && result.isStack){
            if(result.isDeclaratorVariable ){
                return null;
            }
            result = result.type();
        }
        return result;
    }

    raw(name){
        return this.globals.get(this.getKey(name));
    }

    has(name){
        return this.globals.has(this.getKey(name))
    }

    delete(name){
        this.globals.delete(this.getKey(name));
    }
}

const globals = new NamespaceGlobal();
class Namespace {
    static is(value){
        return value ? value instanceof Namespace : false;
    }
    static get globals(){
        return globals;
    }
    static get top(){
        return _top;
    }
    static get dataset(){
        return _top;
    }

    static clearAll(){
        const clear = (ns)=>{
            ns.children.forEach(clear)
            ns.modules.clear();
            ns.children.clear();
            ns.descriptors.clear();
        }
        clear(Namespace.dataset);
        globals.globals.clear();
    }

    constructor( id ){
        this.modules = new Map();
        this.children = new Map();
        this.identifier = id;
        this.id = id;
        this.fullName = id;
        this.parent = null;
        this.isNamespace = true;
        this.stack = null;
        this.chainItems = null;
        this.descriptors = new Map();
        this.exports = new Map();
        this.imports = new Map();
    }
    
    set(name, value){
        const flag = this.addDescriptor(name, value);
        if(!flag && value){
            this.modules.set(name, value);
            if( this.fullName ){
                globals.set(`${this.fullName}.${name}`, value);
            }else{
                globals.set(`${name}`, value);
            }
        }
        return flag;
    }

    has(name){
        return this.modules.has(name);
    }

    del(name){
        if(this.fullName){
            globals.delete(`${this.fullName}.${name}`);
        }else{
            globals.delete(`${name}`);
        }
        return this.modules.delete(name);
    }

    get(name){
        let result = this.modules.get( name );
        if(!result)return null;
        if(!result.isType && result.isStack){
            if(result.isDeclaratorVariable){
                return null;
            }
            result = result.type();
        }
        return result;
    }

    raw(name){
        return this.modules.get(name);
    }

    addDescriptor(name, descriptor, flag=false){
        if(!descriptor || !(flag || descriptor.isDeclaratorFunction || descriptor.isDeclaratorVariable))return false;
        let dataset = this.descriptors.get(name);
        if( !dataset ){
           dataset = [];
           this.descriptors.set(name, dataset);
        }
        dataset.push(descriptor);
        return true;
    }

    checkDescriptors(name, descriptor){
        let dataset = this.descriptors.get(name);
        if( dataset && dataset.length > 1 ){
            if(descriptor.isDeclaratorTypeAlias)return false;
            return !dataset.some( item=>{
                if(item===descriptor)return false;
                if(!item.isSameSource(descriptor))return false;
                if( descriptor.isDeclaratorFunction && item.isDeclaratorFunction){
                    const oldP = item.params;
                    const newP = descriptor.params;
                    if(oldP && newP && oldP.length === newP.length){
                        const oldG = item.genericity;
                        const newG = descriptor.genericity;
                        if(Boolean(oldG) !== Boolean(newG))return false;
                        if(oldG && newG && oldG.elements.length !== newG.elements.length)return false;
                        const oldR = item.getReturnedType();
                        const newR = descriptor.getReturnedType();
                        if(Boolean(oldR) !== Boolean(newR))return false;
                        if(oldR && newR && !Utils.checkTypeForBoth(oldR.type(), newR.type()))return false;
                        return oldP.every( (oldT,index)=>{
                            const newT = newP[index];
                            if( oldT && newT ){
                                if(oldT.question !== newT.question)return false;
                                if(oldT.isRestElement !== newT.isRestElement)return false;
                                return Utils.checkTypeForBoth(oldT.type(), newT.type());
                            }
                        });
                    }
                }else if( descriptor.isDeclaratorVariable && item.isDeclaratorVariable ){
                    return Utils.checkTypeForBoth(descriptor.type(), item.type());
                }
                return false;
            });
        }
        return true;
    }

    sorting(dataset){
        const priority = (item)=>{
            const type = item.type();
            if(!type || type.isGenericType)return 1;
            if(type.isLiteralType && type.isLiteralValueType){
                return 6
            }else if(type.isIntersectionType){
                return 5
            }else if(type.isClassGenericType ){
                const wrap = type.inherit.type();
                if( wrap && wrap.target && wrap.target.isDeclaratorTypeAlias && wrap.target.genericity ){
                    return 4
                }
            }else if(type.isUnionType){
                return 2
            }
            return 3;
        };
        dataset.sort( (a, b)=>{
            if(!a.isDeclaratorFunction){
                if(!b.isDeclaratorFunction)return 0;
                return 1;
            }
            if(!b.isDeclaratorFunction){
                if(!a.isDeclaratorFunction)return 0;
                return -1;
            }
            if(a.params.length < b.params.length){
                return -1;
            }else if( a.params.length > b.params.length){
                return 1;
            }
            const a1 = a.params.reduce( (acc, item)=>{
                if(item.question)acc--;
                return acc + priority(item);
            }, 0);
            const b1= b.params.reduce( (acc, item)=>{
                if(item.question)acc--;
                return acc + priority(item);
            }, 0);
            if( a1===b1 )return 0;
            return a1 > b1 ? -1 : 1;
        });
        return dataset;
    }

    hasDescriptor(name){
        return this.descriptors.has(name);
    }

    getDescriptor(name, filter, {isNew,isCall}={}, result=null){
        const dataset = this.descriptors.get(name);
        if( dataset ){
            if( !filter ){
                return dataset[0] || result;
            }else{
                if( !dataset[privateKey] ){
                    dataset[privateKey] = true;
                    this.sorting(dataset);
                }
                for(let i=0;i<dataset.length;i++){
                    const desc = dataset[i];
                    const value = filter(desc, result, i, dataset);
                    if( value ){
                        if(value === true){
                            return desc;
                        }else{
                            result = value;
                        }
                    }
                }
            }
        }
        if(isCall){
            const module = this.modules.get(name);
            if(module && module.isModule){
                if(isNew){
                    result = module.getDescriptor(`constructor`, filter, {isNew,isCall}, result);
                }else{
                    result = module.getDescriptor(`#${module.id}`, filter, {isNew,isCall}, result);
                }
            }
        }
        return result;
    }

    clear( compilation ){
        if(!compilation)return;
        this.descriptors.forEach( (items,key)=>{
            items.slice(0).forEach( (descriptor)=>{
                if(descriptor.compilation === compilation ){
                    const index = items.indexOf(descriptor);
                    if( index>=0 ){
                        let named = descriptor.namespace ? descriptor.namespace.toString() : '';
                        Logger.print(`clear-descriptor: ${named}.${key}, file:${compilation.file}`, 'namespace')
                        items.splice(index,1);
                    }
                }
            });
            if( !items.length ){
                this.descriptors.delete(key);
            }
        });
        this.modules.forEach( (module,key)=>{
            if(module.compilation === compilation){
                Logger.print(`clear-module: ${module.getName()}, file:${compilation.file}`, 'namespace')
                this.del( key );
            }
        });

        this.exports.forEach( (desc,key)=>{
            if(desc.compilation === compilation){
                Logger.print(`clear-export: ${key}, file:${compilation.file}`, 'namespace')
                this.exports.delete(key);
            }
        });

        this.imports.forEach( (desc,key)=>{
            if(AutoImporter.is(desc)){
                const origins = desc.origins;
                origins.forEach(desc=>{
                    if(desc.compilation === compilation){
                        Logger.print(`clear-auto-importer: ${key}, file:${compilation.file}`, 'namespace')
                        this.imports.delete(key);
                    }
                })
            }else if(desc.compilation === compilation){
                Logger.print(`clear-imports: ${key}, file:${compilation.file}`, 'namespace')
                this.imports.delete(key);
            }
        });
    }

    toString(){
        return this.getChain().join(".");
    }

    definition(){
        const kind = "namespace";
        return {
            expre:`${kind} ${this.toString()}`,
        };
    }

    getChain(){
        if( this.chainItems )return this.chainItems;
        if( this.parent ){
            return this.chainItems = this.parent.getChain().concat(this.identifier);
        }
        return this.chainItems = [];
    }

    getChildrenKeys(){
        const children = [];
        this.children.forEach((value,key)=>{
            const obj = {};
            obj[key] = value.getChildrenKeys();
            children.push(obj);
        });
        return children;
    }

    static create( identifier , flag=false){
        if( !identifier ) {
            return Namespace.dataset;
        }
        const items = identifier.split(".");
        let key = null;
        let base = flag ? new Namespace() : Namespace.dataset;
        if( items[0] ==='global'){
            items.shift();
        }
        while( key = items.shift() ){
            if( base.children.has(key) ){
                base = base.children.get(key);
            }else{
                const np = new Namespace( key ); 
                np.parent = base;
                base.children.set(key, np);
                base = np;
            }
        }
        base.fullName = identifier;
        return base;
    }

    static fetch(id , base=null, onlyNs = false, isDescriptor=false){
        if( !id ) {
            return Namespace.dataset;
        }
        const items = (id+'').split(".");
        const name  = items.pop();
        let key = null;
        base = base || Namespace.dataset;
        if( items[0] ==='global'){
            items.shift();
        }
        while( (key = items.shift()) && base ){
            base = base.children.has(key) ? base.children.get(key) : null;
        }
        if( !base || !(base instanceof Namespace) ){
            return null;
        }
        if(isDescriptor){
            return base.descriptors.get(name);
        }
        if(onlyNs){
            return base.children.get(name);
        }
        return base.has( name ) ? base.get( name ) : base.children.get(name);
        //return base.children && base.children.has(name) ? base.children.get(name) : base.get( name );
    }
}
var _top = new Namespace("");
module.exports = Namespace;