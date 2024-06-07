const LiteralObjectType = require("../types/LiteralObjectType");
const Cache = require("./Cache");
const Module = require("./Module");
const Namespace = require("./Namespace");
const moduleKey = Symbol('JSModule');
const privateKey = Symbol('privateKey');
const records = Cache.group('JSModule.records')
const caches = Cache.group('JSModule.cache');
const resolves = Cache.group('JSModule.resolves');
class JSModule{

    static is(module){
        return module && module[moduleKey] === true;
    }

    static getModule(sourceId, resolvePath){
        if(sourceId.includes('/')){
            sourceId = sourceId.slice(sourceId.lastIndexOf('/')+1)
        }
        let result = records.get(sourceId);
        if(result)return result;
        if(resolves.size>0){
            const source = resolvePath || sourceId;
            const key = resolvePath ? resolvePath +':'+ sourceId : sourceId;
            result = caches.get(key);
            if(result){
                return result;
            }
            for(let [value, regexp] of resolves){
                if(regexp.test(source)){
                    caches.set(key, value);
                    return value
                }
            }
        }
        return null;
    }

    static get(id){
        return records.get(id);
    }

    static set(id, module){
        if(id.includes('*')){
            resolves.set(module, new RegExp('^'+id.replace(/\//g, '\\/').replace(/\./g, '\\.').replace(/\*/g, '\.*')+'$'))
        }
        return records.set(id, module);
    }

    constructor(compilation, id){
        this.id = id;
        this.isJSModule = true;
        this.exports = new Map();
        this.namespaces = new Map();
        this.descriptors = new Map();
        this.types = new Map();
        this.compilation = compilation;
        this.stacks = [];
        this[moduleKey]= true;
        this.file = compilation.file;
        compilation.on('onClear', ()=>this.clear())
    }

    getExportCount(){
        const exists = this._exportDescriptors;
        if(exists)return exists.size;
        let count = this.exports.size;
        this.namespaces.forEach( m=>{
            count += m.descriptors.size
            count += m.exports.size;
            count += m.types.size;
        });
        return count;
    }

    clear(){
        this.exports.clear()
        this.namespaces.clear()
        this.descriptors.clear()
        this.types.forEach( type=>{
            if(Module.is(type)){
                type.clear(this.compilation);
            }
        })
        this.stacks.length = 0;
    }

    addStack(value){
        if( !this.stacks.length || this.compilation !== value.compilation){
            if(!this.stacks.some( s=>s.compilation !== value.compilation)){
                this.stacks.push(value)
            } 
        }
    }

    getStack(){
        return this.stacks[0]
    }

    getExportObjectType(){
        const obj = this._exportAllObject;
        if(obj)return obj;
        const object = new LiteralObjectType(Namespace.globals.get('object'), null, this.getAllExportDescriptors());
        this._exportAllObject = object;
        return object;
    }

    getAllExportDescriptors(){
        const exists = this._exportDescriptors;
        if(exists)return exists;
        const properties = new Map( this.exports );
        this._exportDescriptors = properties;
        this.namespaces.forEach(jsModule=>{
            jsModule.exports.forEach( (value, key)=>{
                if(!properties.has(key)){
                    properties.set(key,value)
                }
            });
            jsModule.types.forEach( (value, key)=>{
                if(!properties.has(key)){
                    properties.set(key,value)
                }
            });
            jsModule.descriptors.forEach( (items,key)=>{
                if(!properties.has(key) && items[0]){
                    properties.set(key, items[0])
                }
            });
        });
        return properties;
    }

    get(name='default', ns=null){
        if(this.exports.has(name)){
            return this.exports.get(name)
        }
        if(ns && name !=='default'){
            const namespace = this.namespaces.get(ns);
            if(namespace){
                let desc = namespace.get(name, ns);
                if(desc){
                    return desc;
                }
                const descriptors = namespace.descriptors.get(name);
                if(descriptors && descriptors.length>0){
                    return descriptors[0];
                }
                return namespace.getType(name);
            }
        }
        return null;
    }

    set(name, desc){
        this.exports.set(name, desc);
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
        return result;
    }

    addDescriptor(name, descriptor){
        let dataset = this.descriptors.get(name);
        if( !dataset ){
           dataset = [];
           this.descriptors.set(name, dataset);
        }
        dataset.push(descriptor);
    }

    setType(name, type){
        this.types.set(name, type)
    }

    getType(name){
        return this.types.get(name)
    }

}


module.exports = JSModule;