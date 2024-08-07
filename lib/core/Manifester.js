const path = require("path");
const Namespace = require("./Namespace");
class Manifester{
    dataset = Object.create(null);
    modules = Object.create(null);
    datamap = new Map();
    cache = new Map();
    #compiler = null;
    constructor(compiler){
        this.#compiler = compiler;
    }

    clear(){
        this.datamap.clear();
        this.cache.clear();
        this.dataset = Object.create(null);
        this.modules = Object.create(null);
    }

    add(manifest, context){
        if(context && (manifest.types || manifest.modules) && Array.isArray(manifest.files) && manifest.files.length > 0){
            context = this.#compiler.normalizePath(context);
            this.#compiler.printLogInfo(`add: ${context}`,'manifester')
            if( !this.datamap.has(context) ){
                this.datamap.set(context, manifest);
                if(manifest.types){
                    const dataset = this.dataset;
                    const value = [manifest, context];
                    Object.keys(manifest.types).forEach(key=>{
                        if(dataset[key]){
                            const records = dataset[key][0].types[key];
                            const merges = records.merges || (records.merges=[]);
                            merges.push(value);
                        }else{
                            dataset[key] = value;
                        }
                    });
                }

                if(manifest.modules){
                    const dataset = this.modules;
                    const value = [manifest, context];
                    Object.keys(manifest.modules).forEach(key=>{
                        if(dataset[key]){
                            const records = dataset[key][0].modules[key];
                            const merges = records.merges || (records.merges=[]);
                            merges.push(value);
                        }else{
                            dataset[key] = value;
                        }
                    });
                }
            }
        }else{
            this.#compiler.printLogInfo(`Error: Add manifest is invalid. in folders the "${context}".`,'manifester')
        }
    }

    getFileinfo(id, recordsFlag=false, isModule=false){
        let key = isModule ? 'modules:'+id : 'types:'+id;
        let records = this.cache.get(key);
        if(records)return records;
        const value = isModule ? this.modules[id] : this.dataset[id];
        this.#compiler.printLogInfo(`getFileinfo: [isModule=${String(isModule)}] result:${Boolean(value)}`,'manifester')
        if( value ){
            const [manifest, context] = value;
            if(manifest){
                const inherits=[];
                const scope = manifest.scope.name;
                const files = this.getFiles(id, manifest, context, inherits, isModule);
                if(scope){
                    const index = inherits.indexOf(scope);
                    if(index>=0){
                        inherits.splice(index,1);
                    }
                }
                records = {files, scope, inherits};
                if(recordsFlag){
                    this.cache.set(key, records);
                }
                return records
            }
        }
        return null;
    }

    hasResource(id, isModule=false){
        if(isModule){
            return !!this.modules[id];
        }
        return !!this.dataset[id];
    }

    getFiles(id, manifest, context, scopes=[], isModule=false){
        const records = isModule ? manifest.modules[id] : manifest.types[id];
        if( records ){
            if( manifest.scope ){
                const names = [];
                if(manifest.scope.name)names.push( manifest.scope.name );
                if(manifest.scope.inherits && Array.isArray(manifest.scope.inherits) ){
                    names.push( ...manifest.scope.inherits );
                }
                names.forEach(name=>{
                    if(!scopes.includes(name)){
                        scopes.push(name);
                    }
                })
            }
            const files = records.indexers.map(index=>{
                const file = manifest.files[index];
                return path.isAbsolute(file) ? file : path.join(context, file);
            });
            if( records.merges ){
                const merges = records.merges.map( ([manifest, context])=>this.getFiles(id, manifest, context, scopes, isModule));
                files.push( ...merges );
            }
            this.#compiler.printLogInfo(`getFiles: scopes:${JSON.stringify(scopes)} \n ${files.join(',\n')}`,'manifester')
            return files;
        }else{
            return [];
        }
    }

    resolveId(id, namespace){
        if(Namespace.dataset === namespace)return id;
        if(this.dataset[id])return id;
        if(namespace && namespace.fullName){
            if(String(id).includes('.'))return id;
            const key = namespace.fullName + '.'+ id;
            if(this.dataset[key])return key;
        }
        return id;
    }

    hasRecords(id, isModule=false){
        let key = isModule ? 'modules:'+id : 'types:'+id;
        return this.cache.has(key);
    }

    deleteRecords(id){
        this.cache.delete(id);
    }
}

module.exports = Manifester;