const LiteralObjectType = require("../types/LiteralObjectType");
const Cache = require("./Cache");
const AutoImporter = require("./AutoImporter");
const Module = require("./Module");
const Namespace = require("./Namespace");
const Utils = require("./Utils");
const moduleKey = Symbol('JSModule');
const privateKey = Symbol('privateKey');
const JSModuleNamespace = Symbol('JSModuleNamespace');
const records = Cache.group('JSModule.records')
const recordFiles = Cache.group('JSModule.recordFiles')
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

    static getGlobalNs(){
        return moduleNamespace;
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
            for(let [value, regexp] of resolves.dataset){
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
            return JSModule.getGlobalNs()
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
            base = parent || JSModule.getGlobalNs()
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
        if(!ns)return null;
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
            nsModule.#isNamespaceModule = true;
            nsModule.#namespace = ns;
            if(module){
                module.namespaces.set(key, nsModule)
            }
            ns.modules.set(key, nsModule);
        }else{
            if(module && !module.namespaces.has(key)){
                module.namespaces.set(key, nsModule)
            }
        }
        return nsModule;
    }

    static createModule(id, compilation){
        let module = JSModule.get(id);
        if(!module){
            module = new JSModule(compilation, id);
            module.#namespace = JSModule.getNamespace();
            JSModule.set(id, module);
            if(compilation.file){
                if(!recordFiles.has(compilation.file)){
                    recordFiles.set(compilation.file, module)
                }
            }
        }
        return module;
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
        let base = JSModule.getGlobalNs();
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

    static getByFile(file){
        return recordFiles.get(file);
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

    #stacks = [];
    #exports = new Map();
    #children = new Map();
    #descriptors = new Map();
    #types = new Map();
    #id = "";
    #isJSModule = true;
    #namespace = null;
    #file = '';
    #isNamespaceModule = false;
    #compilation = null;
    #references = null;

    constructor(compilation, id){
        this.#id = id;
        this.#compilation = compilation;
        this.#file = compilation.file;
        this[moduleKey]= true;
        compilation.on('onClear', ()=>this.clear())
    }

    addJSModuleRefs(jsModule){
        if(jsModule){
            const refs = this.#references || (this.#references=new Set())
            refs.add(jsModule);
        }
    }

    get compilation(){
        return this.#compilation;
    }

    get isNamespaceModule(){
        return this.#isNamespaceModule;
    }

    get file(){
        return this.#file;
    }

    get namespace(){
        return this.#namespace;
    }

    get isJSModule(){
        return this.#isJSModule;
    }

    get types(){
        return this.#types;
    }

    get descriptors(){
        return this.#descriptors;
    }

    get namespaces(){
        return this.#children;
    }

    get exports(){
        return this.#exports;
    }

    get id(){
        return this.#id;
    }

    description(){
        return this;
    }

    descriptor(){
        return this;
    }

    toString(){
        return this.id;
    }

    getExportCount(){
        return this.exports.size;
    }

    clear(compilation){
        compilation = compilation || this.compilation;
        this.exports.forEach( (desc,key)=>{
            if(desc.compilation === compilation){
                this.exports.delete(key)
            }
        });
        this.namespaces.forEach( (module, key)=>{
            module.clear(compilation);
            if(module.compilation === compilation){
                this.namespaces.delete(key);
            }
        });
        this.descriptors.forEach( (items)=>{
            items.forEach( (item)=>{
                if(item.compilation === compilation){
                    let index = items.indexOf(item);
                    items.splice(index, 1)
                }
            })
        })
        this.types.forEach( (desc, key)=>{
            const type = desc.type();
            if(Module.is(type)){
                type.clear(compilation);
            }
            if(desc.compilation === compilation){
                this.types.delete(key);
            }
        });
        let stacks = this.getStacks();
        stacks.forEach( (stack)=>{
            if(stack.compilation === compilation){
                let index = stacks.indexOf(stack);
                stacks.splice(index, 1)
            }
        });
        if(this.namespace){
            this.namespace.clear(compilation);
        }
        const refs = this.#references;
        if(refs){
            refs.forEach( jsModule=>jsModule.clear(compilation))
        }
        recordFiles.clear(compilation.file);
    }

    addStack(value){
        if( !this.#stacks.length || this.compilation !== value.compilation){
            this.#stacks.push(value)
        }
    }

    getStack(){
        return this.#stacks[0]
    }

    getStacks(){
        return this.#stacks;
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
                return items.concat(this.#stacks).map(stack=>stack.definition(ctx));
            }
        }
        return this.#stacks.map(stack=>stack.definition(ctx));
    }

    hover(ctx){
        const desc = this.exports.get('*');
        let stack = this.#stacks[0];
        let members = null;
        if(desc && desc.isExportAssignmentDeclaration && desc.expression.isIdentifier){
            let key = desc.expression.value();
            let items = this.descriptors.get(key);
            if(!items && this.types.has(key)){
                items =[this.types.get(key)]
            }
            if(items){
                members = items.map(item=>item.hover(ctx));
            }
        }
        let def = stack.hover(ctx);
        let overview = this.#stacks.filter(item=>item!==stack).map(stack=>stack.definition(ctx));
        if(members){
            overview = overview.concat(members);
        }
        return stack.formatHover(def, overview);
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
            if(name !== 'default'){
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
            }
            desc = desc.description();
            if(desc){
                if( desc.isClassDeclaration || 
                    desc.isDeclaratorDeclaration || 
                    desc.isEnumDeclaration || 
                    desc.isInterfaceDeclaration || 
                    desc.isTypeStatement ||
                    desc.isDeclaratorFunction || 
                    desc.isDeclaratorVariable ||
                    desc.isDeclaratorTypeAlias ||
                    desc.isStructTableDeclaration
                ){
                    if(name === 'default'){
                        return desc;
                    }
                }
                if(desc.isObjectExpression){
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
            if(name==='default')return null;
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
        let desc = this.exports.get('*');
        if(desc){
            if(desc.isExportAssignmentDeclaration){
                return desc.type()
            }else if(desc.isExportAllDeclaration){
                if(desc.source){
                    const jsModule = desc.getResolveJSModule();
                    if(jsModule){
                        return jsModule.getExportObjectType();
                    }
                }
            }
        }
        const obj = this._exportAllObject;
        if(obj)return obj;
        const object = new LiteralObjectType(Namespace.globals.get('object'), null, this.getAllExportDescriptors());
        object.isJSModuleType = true;
        this._exportAllObject = object;
        return object;
    }

    getAllExportDescriptors(){
        let exists = this._allExportDescriptors;
        if(exists)return exists;
        if(this.exports.size===0){
            return this.getAllDescriptors();
        }

        const properties = this._allExportDescriptors = new Map();
        let desc = this.exports.get('*');
        this.exports.forEach((value, key)=>{
            if(key==='*')return;
            properties.set(key, value);
        });

        if(this.exports.has(this.id)){
            let nsModule = this.namespaces.get(this.id);
            if(nsModule){
                nsModule.getAllDescriptors().forEach((value,key)=>{
                    properties.set(key, value);
                });
            }
        }

        if(!desc){
            return properties;
        }

        if(desc.isExportAssignmentDeclaration){
            const isRefs = desc.expression.isIdentifier;
            let nsModule = null;
            let key = null;
            if(isRefs){
                key = desc.expression.value();
                nsModule = this.namespaces.get(key);
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
                }else if(key){
                    const _desc = desc.descriptor();
                    if(JSModule.is(_desc)){
                        _desc.getAllExportDescriptors().forEach( (value, key)=>{
                            properties.set(key, value);
                        })
                    }else{
                        properties.set(key,_desc);
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

    getExportDefaultNamespace(){
        let exported = this.exports.get('default');
        if(exported){
            let desc = exported.description();
            if(desc && desc.isNamespaceDeclaration){
                return desc.module
            }
        }
        exported = this.exports.get('*');
        if(!exported)return null;
        if(exported.isExportAssignmentDeclaration){
            const key = exported.expression.isIdentifier ? exported.expression.value() : null;
            return this.namespaces.get(key);
        }else if(exported.isExportAllDeclaration){
            if(exported.source){
                const jsModule = exported.getResolveJSModule();
                if(jsModule){
                    return jsModule.getExportDefaultNamespace();
                }
            }
        }
        return null;
    }

    getModuleDefaultDesriptor( property=null ){
        const get = (desc, id)=>{
            if(desc){
                if(desc.isDeclaratorVariable){
                    if(property){
                        if(desc.getObjectDescriptor(desc.type(), property)){
                            return desc;
                        }
                    }else{
                        return desc;
                    }
                }
                if( desc.isClassDeclaration || 
                    desc.isDeclaratorDeclaration || 
                    desc.isEnumDeclaration || 
                    desc.isInterfaceDeclaration || 
                    desc.isDeclaratorTypeAlias ||
                    desc.isStructTableDeclaration
                ){
                    return desc.type()
                }else if(desc.isObjectExpression){
                    return desc.properties.get('default')
                }else if(desc.isNamespaceDeclaration && desc.module){
                    return property && desc.module.hasDescriptor(property) ? desc.module : null;
                }else if(Utils.isStack(desc)){
                    desc = desc.descriptor();
                    if(JSModule.is(desc)){
                        return desc.getModuleDefaultDesriptor()
                    }
                }
            }
            if(property && id){
                let nsModule = this.namespaces.get(id);
                if(nsModule && nsModule.hasDescriptor(property)){
                    return nsModule;
                }
            }
            return desc;
        }

        let exported = this.exports.get('default');
        if(exported){
            let desc = exported.description();
            if(desc){
                return get(desc);
            }
        }

        exported = this.exports.get('*');
        if(!exported)return null;
        
        if(exported.isExportAssignmentDeclaration){
            return get(exported.description(), property && exported.expression.isIdentifier ? exported.expression.value() : null)
        }else if(exported.isExportAllDeclaration){
            if(exported.source){
                const jsModule = exported.getResolveJSModule();
                if(jsModule){
                    return jsModule.getModuleDefaultDesriptor( property );
                }
            }
        }
        return null;
    }


    createImportDescriptors(source){
        source = source || this.id;
        const records = this.__createImportDescriptors || (this.__createImportDescriptors=Object.create(null));
        if(records[source]){
            return records[source];
        }

        const properties = records[source] = new Map();
        const createItem = (source, local, imported, extract, origin, desc=null, owner=null, isDefault=false)=>{
            const item = AutoImporter.create(source, local, imported, extract, isDefault, origin);
            item.owner = owner;
            item.description = desc;
            return item;
        }
        const cache = new WeakSet();
        const createAll = (object, source, extract=true)=>{
            if(cache.has(object))return;
            cache.add(object);
            object.types.forEach((value, key)=>{
                const type = value.type();
                if(Module.is(type) && type.isClass){
                    properties.set(key,createItem(source, key, key, extract, value, type, object));
                }
            })
            object.descriptors.forEach((value,key)=>{
                const items = value.filter(item=>item.isDeclaratorFunction || item.isDeclaratorVariable)
                if(items[0]){
                    properties.set(key, createItem(source, key, key, extract, items[0], items[0], object));
                }
            });
            return properties;
        }

        if(this.exports.size===0){
            return createAll(this, source);
        }

        let desc = this.exports.get('*');
        this.exports.forEach((value, key)=>{
            if(key==='*')return;
            if(value.isExportDefaultDeclaration){
                const desc = value.description();
                const key = this.id;
                properties.set(key, createItem(source, key, key, false, value, desc, this, true));
            }else if(value.isExportSpecifier){
                let exported = value.exported.value();
                let local = value.local.value();
                let desc = value.description();
                if(desc.isDeclaratorVariable || desc.isDeclaratorFunction){
                    properties.set(key, createItem(source, exported, local, true, value, desc, this));
                }else if(desc.isClassDeclaration || desc.isDeclaratorDeclaration){
                    const type = desc.type();
                    if(Module.is(type) && type.isClass){
                        properties.set(type.id, createItem(source, type.id, type.id, false, value, desc, this));
                    }
                }
            }else if(value.isExportNamedDeclaration){
                const decl = value.declaration;
                if(decl){
                    if(decl.isVariableDeclaration || decl.isDeclaratorVariable){
                        decl.declarations.forEach( decl=>{
                            let key = decl.id.value();
                            properties.set(key, createItem(source, key, key, true, decl, decl.description(), this));
                        });
                    }else if(decl.isNamespaceDeclaration){
                        if(decl.module){
                            createAll(decl.module, source);
                        }
                    }else if(decl.isDeclaratorDeclaration ||decl.isClassDeclaration){
                        let key = decl.value();
                        let type = decl.type();
                        if(Module.is(type) && type.isClass){
                            properties.set(key, createItem(source, key, key, true, decl, type, this));
                        }
                    }else if(decl.isDeclaratorFunction){
                        key=decl.value();
                        properties.set(key, createItem(source, key, key, true, decl, decl, this));
                    }
                }
            }
            else if(value.isExportAllDeclaration){
                properties.set(key, createItem(source, key, '*', false, value, value.getResolveJSModule(), this));
            }
        });

        if(this.exports.has(source)){
            let nsModule = this.namespaces.get(source);
            if(nsModule){
                createAll(nsModule, source)
            }
        }

        if(!desc){
            return properties;
        }

        if(desc.isExportAssignmentDeclaration){
            const isRefs = desc.expression.isIdentifier;
            let nsModule = null;
            if(isRefs){
                nsModule = this.namespaces.get(desc.expression.value());
                if(nsModule){
                    createAll(nsModule, source);
                }
            }
            const origin = desc;
            desc = desc.description();
            if(desc){
                if(desc.isDeclaratorVariable || desc.isDeclaratorFunction){
                    const key = desc.value();
                    properties.set(key, createItem(source, key, key, false, origin, desc, this));  
                }else if(desc.isClassDeclaration || desc.isDeclaratorDeclaration){
                    const key = desc.value();
                    const type = desc.type();
                    if(Module.is(type) && type.isClass){
                        properties.set(key, createItem(source, key, key, false, origin, type, this));  
                    }
                }else if(desc.isObjectExpression){
                    desc.properties.forEach( (value, key)=>{
                        if(key==='default'){
                            properties.set(key, createItem(source, key, key, false, origin, value, this,true));
                        }else{
                            properties.set(key, createItem(source, key, key, true, origin, value, this)); 
                        }
                    })
                }else if(desc.isNamespaceDeclaration && desc.module && nsModule !== desc.module){
                    createAll(desc.module, source);
                }
            }

        }else if(desc.isExportAllDeclaration){
            if(desc.source){
                const jsModule = desc.getResolveJSModule();
                if(jsModule){
                    if(desc.exported){
                        let key = desc.exported.value();
                        properties.set(key, createItem(source, key, '*', true, desc, jsModule, jsModule));
                    }else{
                        jsModule.createImportDescriptors(source).forEach( (value, key)=>{
                            properties.set(key, value);
                        })
                    }
                }else{
                    desc.getAllExportDescriptors().forEach((value, key)=>{
                        properties.set(key, value);
                    })
                }
            }else if(JSModule.is(desc.module)){
                createAll(desc.module, source);
            }
        }
        return properties;
    }

    getAllDescriptors(){
        const exists = this._allDescriptors;
        if(exists)return exists;
        const properties = new Map();
        this._allDescriptors = properties;
        this.descriptors.forEach((value,key)=>{
            if(value[0] && !value[0].isTypeStatement)properties.set(key, value[0])
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
        return this.descriptors.has(name) || this.exports.has(name);
    }

    getDescriptor(name, filter, {isNew,isCall,isMember}={}, result=null){
        let dataset = this.descriptors.get(name);
        if(!dataset){
            let exported = this.exports.get(name);
            if(exported){
                let desc = exported.descriptor();
                if(desc){
                    if(desc.isModuleDeclaration){
                        if(desc.module){
                            return desc.module
                        }
                        return null;
                    }else if(JSModule.is(desc)){
                        return desc;
                    }else if(JSModule.is(desc.module) && desc.module !== this){
                        return desc.module.getDescriptor(desc.value(), filter, {isNew,isCall,isMember}, result)
                    }
                }
                return desc;
            }else{
                let desc = this.exports.get('*');
                if(!desc)return null;
                if(desc.isExportAllDeclaration){
                    if(desc.source){
                        const jsModule = desc.getResolveJSModule();
                        if(jsModule){
                            return jsModule.getDescriptor(name, filter, {isNew,isCall,isMember}, result)
                        }else{
                            let result = desc.getAllExportDescriptors().get(name);
                            if(result){
                                dataset = [result];
                            }
                        }
                    }
                }else if(desc.isExportAssignmentDeclaration){
                    if(desc.expression.isIdentifier){
                        const key = desc.expression.value();
                        let _desc = desc.expression.description();
                        if(_desc && (_desc.isImportNamespaceSpecifier || _desc.isImportDefaultSpecifier || _desc.isImportSpecifier)){
                            let descriptor = _desc.descriptor();
                            if(JSModule.is(descriptor)){
                                return descriptor.getDescriptor(name, filter, {isNew,isCall,isMember}, result)
                            }
                        }
                        if(this.id === key && _desc){
                            if(isMember){
                                if(_desc.isDeclaratorVariable || _desc.isDeclaratorFunction){
                                    let descriptor = desc.expression.getObjectDescriptor(_desc.type(), name);
                                    if(descriptor)return descriptor;
                                }
                            }
                        }
                        const nsModule = this.namespaces.get(key);
                        if(nsModule){
                            return nsModule.getDescriptor(name, filter, {isNew,isCall,isMember}, result)
                        }else{
                            dataset = this.descriptors.get(key);
                        }
                    }
                }
            }
        }

        if( dataset ){
            if( !filter ){
                return dataset[0] || result;
            }else{
                if(!dataset[privateKey]){
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
        if(descriptor.isDeclaratorVariable || descriptor.isDeclaratorFunction){
            dataset.unshift(descriptor);
        }else{
            dataset.push(descriptor);
        }
    }

    setType(name, stack){
        this.types.set(name, stack)
        this.addDescriptor(name, stack);
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