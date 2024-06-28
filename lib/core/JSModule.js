const LiteralObjectType = require("../types/LiteralObjectType");
const Cache = require("./Cache");
const Module = require("./Module");
const Namespace = require("./Namespace");
const moduleKey = Symbol('JSModule');
const privateKey = Symbol('privateKey');
const JSModuleNamespace = Symbol('JSModuleNamespace');
const records = Cache.group('JSModule.records')
const caches = Cache.group('JSModule.cache');
const resolves = Cache.group('JSModule.resolves');
const namespaces = Cache.group('JSModule.namespaces');
const moduleNamespace = new Namespace("");
moduleNamespace[JSModuleNamespace] = true;
namespaces.set('#global#', moduleNamespace);
class JSModule{

    static is(module){
        return module && module[moduleKey] === true;
    }

    static isJSModuleNamespace(ns){
        return ns && ns[JSModuleNamespace] === true;
    }

    static getModule(sourceId, resolvePath){
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

    static getNamespace(id="", parent=null){
        if(!id){
            return namespaces.get('#global#');
        }
        if(id==="global"){
            return Namespace.top;
        }
        const items = id.split(".");
        let key = null;
        let base = null;
        if( items[0] ==='global'){
            items.shift();
            base = Namespace.top;
        }else{
            base = parent || namespaces.get('#global#');
        }
        while(key=items.shift()){
            if( base.children.has(key) ){
                base = base.children.get(key);
            }else{
                const ns = new Namespace(key); 
                if(base[JSModuleNamespace]){
                    ns[JSModuleNamespace] = true;
                }
                ns.parent = base;
                base.children.set(key, ns);
                base = ns;
            }
        }
        return base;
    }

    static getType(id, onlyType=false, isMember=false){
        if(!id || id==='global'){
            return null;
        }
        const at = id.lastIndexOf('.');
        if(at<1){
            return null;
        }
        let key = id.substring(0, at);
        let name = id.slice(at+1);
        let ns = JSModule.getNamespace(key);
        let module =  ns.modules.get(ns.id);
        if(module){
            if(isMember){
                return module.namespaces.get(name) || module.getType(name);
            }
            return module.getType(name) || (!onlyType ? module.namespaces.get(name) : null);
        }
        return null;
    }

    static createModuleFromNamespace(id, module, compilation){
        let ns = id.includes('.') ? JSModule.getNamespace(id) : JSModule.getNamespace(id, module ? module.namespace : null);
        let key = ns.id;
        if(!key){
            return ns;
        }
        let nsModule = ns.modules.get(key);
        if(!nsModule && key){
            nsModule = new JSModule(compilation, key);
            nsModule.isNamespaceModule = true;
            nsModule.namespace = ns;
            if(module){
                module.namespaces.set(key, nsModule)
            }
            ns.modules.set(key, nsModule);
        }
        return nsModule;
    }

    static getModuleFromNamespace(id){
        if(!id || id==='global'){
            return null;
        }
        const items = id.split(".");
        if( items[0] ==='global'){
            return null;
        }
        let key = null;
        let base = namespaces.get('#global#');
        let module = null;
        while(key=items.shift()){
            if( base.children.has(key) ){
                base = base.children.get(key);
                module = base.modules.get(key);
            }else{
                return null;
            }
        }
        return module;
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
        this.isNamespaceModule = false;
        this.exports = new Map();
        this.namespaces = new Map();
        this.descriptors = new Map();
        this.types = new Map();
        this.compilation = compilation;
        this.stacks = [];
        this[moduleKey]= true;
        this.file = compilation.file;
        this.namespace = null;
        compilation.on('onClear', ()=>this.clear())
    }

    toString(){
        return this.id;
    }

    getExportCount(){
        return this.exports.size;
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
            this.stacks.push(value)
        }
    }

    getStack(){
        return this.stacks[0]
    }

    getStacks(){
        return this.stacks;
    }

    definition(ctx){
        const desc = this.exports.get('*');
        if(desc && desc.isExportAssignmentDeclaration && desc.expression.isIdentifier){
            let key = desc.expression.value();
            let items = this.descriptors.get(key);
            if(!items && this.types.has(key)){
                items =[this.types.get(key)]
            }
            if(items){
                return items.concat(this.stacks).map(stack=>stack.definition(ctx));
            }
        }
        return this.stacks.map(stack=>stack.definition(ctx));
    }

    type(){
        return this.getExportObjectType();
    }

    getDefaultExported(){
        if(this.exports.size === 0){
            return null;
        }
        let value = this.exports.get('default');
        if(value){
            return value
        }
        const desc = this.exports.get('*');
        if(desc){
            const type = desc.type();
            const fetch = (type)=>{
                if(!type)return null;
                if(type.isLiteralObjectType ){
                    return type.attributes.get('default')
                }else if(type.isIntersectionType){
                    return fetch(type.left.type()) || fetch(type.right.type());
                }
                return null;
            }
            return fetch(type);
        }
        return null;
    }

    getExport(name, flag=false){
        let desc = this.exports.get(name);
        if(desc){
            if(flag)return desc;
            return desc.description();
        }

        if(this.exports.has(this.id)){
            let nsModule = this.namespaces.get(this.id);
            if(nsModule){
                let desc = nsModule.getDescriptor(name);
                if(desc){
                    return desc;
                }
            }
        }
        desc = this.exports.get('*');
        if(!desc)return null;
        if(desc.isExportAssignmentDeclaration){
            const isRefs = desc.expression.isIdentifier;
            if(isRefs){
                let nsModule = this.namespaces.get(desc.expression.value());
                if(nsModule){
                    let desc = nsModule.getDescriptor(name) || nsModule.getExport(name, flag);
                    if(desc){
                        return desc;
                    }
                }
            }
            desc = desc.description();
            if(desc){
                if( desc.isClassDeclaration || 
                    desc.isDeclaratorDeclaration || 
                    desc.isEnumDeclaration || 
                    desc.isInterfaceDeclaration || 
                    desc.isTypeStatement ||
                    desc.isDeclaratorTypeAlias ||
                    desc.isStructTableDeclaration
                ){
                    return desc;
                }else if(desc.isObjectExpression){
                    return desc.attribute(name);
                }else if(desc.isNamespaceDeclaration){
                    if(desc.module){
                        return desc.module.getExport(name, flag)
                    }
                }else{
                    return this.getExportFromType(desc.type(), name, desc);
                }
            }
        }else if(desc.isExportAllDeclaration){
            if(desc.source){
                const jsModule = desc.getResolveJSModule();
                if(jsModule){
                    return jsModule.getExport(name, flag)
                }else{
                    return desc.getAllExportDescriptors().get(name);
                }
            }else if(JSModule.is(desc.module)){
                return desc.module.getDescriptor(name);
            }
        }
        return null;
    }

    getExportFromType(type, name, stack){
        if(!type)return null;
        if(type.isLiteralObjectType ){
            return type.attributes.get(name);
        }else if(type.isIntersectionType){
            return this.getExportFromType(type.left.type(), name) || 
                    this.getExportFromType(type.right.type(), name);
        }else if(type.isUnionType){
            for(let i=0; i<type.elements.length;i++){
                const result = this.getExportFromType(type.elements[i].type(), name, stack);
                if(result){
                    return result;
                }
            }
        }
        else if(stack && stack.isStack && stack.getObjectDescriptor){
            return stack.getObjectDescriptor(type, name);
        }
        return null;
    }

    getExportObjectType(){
        const obj = this._exportAllObject;
        if(obj)return obj;
        if(this.exports.has('*')){
            const desc = this.exports.get('*');
            return this._exportAllObject = desc.type();
        }
        const object = new LiteralObjectType(Namespace.globals.get('object'), null, this.getAllExportDescriptors());
        this._exportAllObject = object;
        return object;
    }

    getAllExportDescriptors(){
        let exists = this._allExportDescriptors;
        if(exists)return exists;
        let desc = this.exports.get('*');
        if(!desc){
            const properties = this._allExportDescriptors = new Map(this.exports);
            if(this.exports.has(this.id)){
                let nsModule = this.namespaces.get(this.id);
                if(nsModule){
                    nsModule.getAllDescriptors().forEach((value,key)=>{
                        properties.set(key, value);
                    });
                }
            }
            return properties;
        }

        const properties = this._allExportDescriptors = new Map();
        if(desc.isExportAssignmentDeclaration){
            const isRefs = desc.expression.isIdentifier;
            let nsModule = null;
            if(isRefs){
                nsModule = this.namespaces.get(desc.expression.value());
                if(nsModule){
                    nsModule.getAllDescriptors().forEach( (value, key)=>{
                        properties.set(key, value);
                    })
                }
            }
            desc = desc.description();
            if(desc){
                if( desc.isClassDeclaration || 
                    desc.isDeclaratorDeclaration || 
                    desc.isEnumDeclaration || 
                    desc.isInterfaceDeclaration || 
                    desc.isDeclaratorVariable ||
                    desc.isDeclaratorFunction ||
                    desc.isDeclaratorTypeAlias ||
                    desc.isStructTableDeclaration
                ){
                    properties.set(desc.value(), desc)
                }else if(desc.isObjectExpression){
                    desc.properties.forEach( (value, key)=>{
                        properties.set(key, value)
                    })
                }else if(desc.isNamespaceDeclaration && desc.module && nsModule !== desc.module){
                    if(desc.module.exports.size>0){
                        desc.module.getAllExportDescriptors().forEach( (value, key)=>{
                            properties.set(key, value);
                        })
                    }else{
                        desc.module.getAllDescriptors().forEach( (value, key)=>{
                            properties.set(key, value);
                        })
                    }
                }
            }

        }else if(desc.isExportAllDeclaration){
            let object = null;
            if(desc.source){
                const jsModule = desc.getResolveJSModule();
                if(jsModule){
                    object = jsModule.getAllExportDescriptors();
                }else{
                    object = desc.getAllExportDescriptors();
                }
            }else if(JSModule.is(desc.module)){
                object = desc.module.getAllDescriptors()
            }
            if(object){
                object.forEach((value, key)=>{
                    properties.set(key, value);
                })
            }
        }
        return properties;
    }

    getAllDescriptors(){
        const exists = this._allDescriptors;
        if(exists)return exists;
        const properties = new Map(this.types);
        this._allDescriptors = properties;
        this.descriptors.forEach((value,key)=>{
            if(value[0])properties.set(key, value[0])
        })
        return properties;
    }

    get(name='default', ns=null){
        if(name==='default'){
            return this.getDefaultExported();
        }
        let object = this.exports.get(name);
        if(object)return object
        if(!ns)ns = this.id;
        if(ns){
            let module = this.namespaces.get(ns);
            if(module){
                return module.getType(name) || module.getDescriptor(name);
            }
        }
        return null;
    }

    has(name){
        return this.exports.has(name);
    }

    set(name, desc){
        if(name ==='default' || !this.exports.has(name)){
            this.exports.set(name, desc);
        }
    }

    del(name){
        this.exports.delete(name);
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
        const desc = this.types.get(name);
        if(desc){
            return desc;
        }
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
    
    getType(id){
        const desc = this.__getType(id);
        if(desc){
            return desc.type();
        }
        return null;
    }

    __getType(id){
        if(id.includes('.')){
            const items = id.split('.');
            const name = items.pop();
            let module = this;
            while(items.length>0 && module){
                const key = items.shift();
                module = module.namespaces.get(key)
            }
            if(module){
                return module.types.get(name);
            }
            return null;
        }
        return this.types.get(id);
    }

}


module.exports = JSModule;