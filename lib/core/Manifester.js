const path = require("path");
const Namespace = require("./Namespace");
class Manifester{
    dataset = Object.create(null);
    datamap = new Map();
    cache = new Map();
    add(manifest, context){
        if(context && manifest.types && Array.isArray(manifest.files) && manifest.files.length > 0){
            context = path.normalize(context);
            if( !this.datamap.has(context) ){
                this.datamap.set(context, manifest);
                const dataset = this.dataset;
                const value = [manifest, context];
                Object.keys(manifest.types).forEach(key=>{
                    if(dataset[key]){
                        const merges = dataset[key].types[key].merges || (dataset[key].types[key].merges=[]);
                        merges.push(value);
                    }else{
                        dataset[key] = value;
                    }
                });
            }
        }else{
            throw new Error('Add manifest is invalid.')
        }
    }

    getFileinfo(id, recordsFlag=false){
        let records = this.cache.get(id);
        if(records)return records;
        const value = this.dataset[id];
        if( value ){
            const [manifest, context] = value;
            if(manifest){
                const inherits=[];
                const scope = manifest.scope.name;
                const files = this.getFiles(id, manifest, context, inherits);
                if(scope){
                    const index = inherits.indexOf(scope);
                    if(index>=0){
                        inherits.splice(index,1);
                    }
                }
                records = {files, scope, inherits};
                if(recordsFlag){
                    this.cache.set(id, records);
                }
                return records
            }
        }
        return null;
    }

    getFiles(id, manifest, context, scopes=[]){
        const records = manifest.types[id];
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
                const merges = records.merges.forEach( ([manifest, context])=>this.getFiles(id, manifest, context, scopes));
                files.push( ...merges );
            }
            return files;
        }else{
            return [];
        }
    }

    resolveId(id, namespace){
        if(Namespace.dataset === namespace)return id;
        if(this.dataset[id])return id;
        if(namespace && namespace.fullName){
            const key = namespace.fullName + '.'+ id;
            if(this.dataset[key])return key;
        }
        return id;
    }

    hasRecords(id){
        return this.cache.has(id);
    }

    deleteRecords(id){
        this.cache.delete(id);
    }
}

module.exports = Manifester;