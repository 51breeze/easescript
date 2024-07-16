const groups = new Map();
class Cache{

    static clearAll(){
        groups.forEach( cache=>{
            cache.clear();
        })
    }

    static group(name){
        let cache = groups.get(name);
        if(!cache){
            cache = new Cache(name);
        }
        return cache;
    }

    static global(){
        return this.group('global');
    }

    static each(finder){
        groups.forEach(cache=>{
            cache.keys().forEach( key=>finder(key,cache) )
        });
    }

    static keys(finder){
        const dataset = new Map();
        groups.forEach(cache=>{
            if(finder){
                dataset.set(cache,cache.keys().filter( key=>{
                    return finder(key, cache)
                }));
            }else{
                dataset.set(cache, cache.keys());
            }
        });
        return dataset;
    }

    static all(){
        return Array.from(groups.values());
    }

    constructor(name){
        this.name = name;
        this.dataset = new Map();
        groups.set(name, this);
    }

    get(name){
        if( this.has(name) ){
            return this.dataset.get(name);
        }
        return void 0;
    }

    set(name, value){
        this.dataset.set(name,value);
        return this;
    }

    has(name){
        return this.dataset.has(name);
    }

    records(name, initValue=true, flag=true){
        if(!name)return flag;
        if( !this.has(name) ){
            this.set(name, initValue);
            return false
        }else{
            return true;
        }
    }

    clear(name){
        if(name){
            delete this.dataset.delete(name);
        }else{
            this.dataset.clear();
        }
    }

    values(){
        return Array.from(this.dataset.values());
    }

    keys(){
        return Array.from(this.dataset.keys());
    }
}

module.exports = Cache;
