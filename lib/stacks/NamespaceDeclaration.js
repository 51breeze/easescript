const ModuleDeclaration = require("./ModuleDeclaration");
class NamespaceDeclaration extends ModuleDeclaration{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isNamespaceDeclaration= true;
    }
    type(){
        return this.module.getExportObjectType();
    }

    description(){
        return this;
    }
    
    async createCompleted(){
        await super.createCompleted()
        if(this.parentStack.isExportNamedDeclaration && this.parentStack.declaration === this){
            const module = this.module;
            module.types.forEach( (value,key)=>{
                if(!module.has(key)){
                    module.set(key, value.type());
                }
            });
            module.descriptors.forEach( (items,key)=>{
                if(!module.has(key)){
                    module.set(key, items[0]);
                }
            });
            module.namespaces.forEach( (module,key)=>{
                if(!module.has(key)){
                    module.set(key, module);
                }
            });
        }
    }
}

module.exports = NamespaceDeclaration;