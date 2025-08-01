const Type = require("../types/Type");
const Namespace = require("./Namespace");
const Utils = require("./Utils");
const symbolKey = Symbol('key');
const Constant = require("./Constant");
const Logger = require("./Logger");
class Module extends Type{
    [Utils.IS_MODULE] = true;
    
    static is(value){
        return value ? value instanceof Module : false;
    }

    constructor( compilation ){
        super(null,null);
        this.compilation = compilation;
        this.id = null;
        this.static = false;
        this.abstract = false;
        this.isFinal = false;
        this.isClass  = false;
        this.isInterface  = false;
        this.isStructTable  = false;
        this.isInterfaceDecorator = false;
        this.isEnum  = false;
        this.namespace = null;
        this._implements=[];
        this.methods=Object.create(null);
        this.members=Object.create(null);
        this.annotations =[];
        this.metatypes = [];
        this.making = false;
        this.dependencies=new Set();
        this.imports=new Map();
        this.importAlias=new Map();
        this.isModule = true;
        this.methodConstructor = null;
        this.file = null;
        this.files = [];
        this.used = false;
        this.callable = false;
        this.children =[];
        this.policy = null;
        this.dynamic = false;
        this.dynamicProperties = new Map();
        this.isFragment = false;
        this.required = false;
        this.assets = new Map();
        this.requires = new Map();
        this.isValid = true;
        this.fullname = null;
        this.metadataFlags = 0;
        this.jsxDeclaredSlots = null;
        this.callMethods=[];
        this.callMembers=[];
        this[symbolKey] = {
            stacks:[],
            stack:null,
        };
        this.removedNamedDescriptors = Object.create(null)
        this.deprecatedNamedDescriptors = Object.create(null);
        this.annotationDescriptors= Object.create(null);
        this.descriptors = new Map();
        
    }

    setAssignGenerics(module, assignments){
        if(!Utils.isModule(module) || !(assignments && assignments.length > 0))return;
        if(module.inherit){
            this.setAssignGenerics(module.inherit.type(), assignments);
        }
        const declareGenerics= module.getModuleDeclareGenerics();
        if(declareGenerics && declareGenerics.length > 0){
            let dataset =this[symbolKey].assignGenerics || (this[symbolKey].assignGenerics = new Map());
            declareGenerics.forEach( (declare,index)=>{
                const value = assignments[index];
                if(value){
                    dataset.set(declare.getUniKey(), value.type());
                }
            });
        }
        module.implements.forEach(imp=>{
            this.setAssignGenerics(imp.type(), assignments);
        });
    }

    getAssignGenerics(declared){
        let dataset = this[symbolKey].assignGenerics;
        if(dataset){
            let key = declared.getUniKey();
            if(dataset.has(key)){
                return dataset.get(key);
            }
        }
        let inherit = this.inherit
        if(inherit && Module.is(inherit)){
           let res = inherit.type().getAssignGenerics(declared);
           if(res)return res;
        }
        let impls = this.implements;
        for(let item of impls){
            let res = item.type().getAssignGenerics(declared);
            if(res)return res;
        }
        return null;
    }

    getAllAssignGenerics(){
        let records = new Map();
        let fetch = (module)=>{
            let dataset = module[symbolKey].assignGenerics;
            if(dataset){
                dataset.forEach((value, key)=>{
                    records.set(key, value)
                })
            }
            let inherit = module.inherit
            if(inherit && Module.is(inherit)){
               fetch(inherit.type());
            }
            let impls = module.implements;
            for(let item of impls){
                fetch(item.type());
            }
            return records;
        }
        return fetch(this);
    }

    get moduleStack(){
        return this[symbolKey].stack || null;
    }

    set moduleStack(value){
        if( value && value.isStack ){
            this[symbolKey].stacks.push(value);
            this[symbolKey].stack = value;
        }
    }

    addStack(value, isDefault=false){
        if( value && value.isStack ){
            this[symbolKey].stacks.push(value);
            if(isDefault || !this[symbolKey].stack){
                this[symbolKey].stack = value;
            }
        }
    }

    getStacks(flag=false){
        if(flag)return this[symbolKey].stacks;
        return this[symbolKey].stacks.filter( stack=>!stack.compilation.isDestroyed );
    }

    getInheritContextStack(compilation){
        let stacks = this.getStacks();
        if(stacks.length===1){
            return stacks[0];
        }
        stacks = stacks.slice(0).sort((a, b)=>{
            let a1 = a.isDestroyed ? 9 : 0;
            let b1 = b.isDestroyed ? 9 : 0;
            if(!a.isDestroyed){
                if(a.compilation === compilation){
                    a1 = -1;
                }else if(a.compilation.isDescriptorDocument()){
                    a1 = 1;
                }
            }
            if(!b.isDestroyed){
                if(b.compilation === compilation){
                    b1 = -1;
                }else if(a.compilation.isDescriptorDocument()){
                    b1 = 1;
                }
            }
            return a1 - b1
        });
        return stacks[0] || null;
    }

    isDecorator(){
        if(this.isInterfaceDecorator)return true;
        if(this.implements.some(item=>{
            if(item.isDecorator())return true;
            return item.extends.some(extend=>extend.isDecorator())
        })){
            return true;
        }
        return this.extends.some(extend=>extend.isDecorator());
    }

    isWebComponent(){
        if(!this.isClass)return false;
        if( this.metadataFlags > 0 ){
            if( (Constant.MODULE_YES_WEB_COMPONENT & this.metadataFlags) === Constant.MODULE_YES_WEB_COMPONENT ){
                return true;
            }else if( (Constant.MODULE_NO_WEB_COMPONENT & this.metadataFlags) === Constant.MODULE_NO_WEB_COMPONENT ){
                return false;
            }
        }
        let result = false;
        const stacks = this.getStacks();
        for(let i=0;i<stacks.length;i++){
            const stack = stacks[i];
            if( stack.findAnnotation((annotation)=>annotation.getLowerCaseName() === 'webcomponent') ){
                result = true;
                break;
            }
        }
        this.metadataFlags |= result ? Constant.MODULE_YES_WEB_COMPONENT : Constant.MODULE_NO_WEB_COMPONENT;
        return result;
    }

    isSkinComponent(){
        if(!this.isClass)return false;
        if( this.metadataFlags > 0 ){
            if( (Constant.MODULE_YES_SKIN_COMPONENT & this.metadataFlags) === Constant.MODULE_YES_SKIN_COMPONENT ){
                return true;
            }else if( (Constant.MODULE_NO_SKIN_COMPONENT & this.metadataFlags) === Constant.MODULE_NO_SKIN_COMPONENT ){
                return false;
            }
        }
        let result = false;
        const stacks = this.getStacks();
        for(let i=0;i<stacks.length;i++){
            const stack = stacks[i];
            if( stack.findAnnotation((annotation)=>annotation.getLowerCaseName() === 'skinclass') ){
                result = true;
                break;
            }
        }
        this.metadataFlags |= result ? Constant.MODULE_YES_SKIN_COMPONENT : Constant.MODULE_NO_SKIN_COMPONENT;
        return result;
    }

    getAnnotations(filter, inheritFlag=true){
        const stacks = this.getStacks();
        for(let i=0;i<stacks.length;i++){
            const stack = stacks[i];
            const result = stack.findAnnotation(filter,inheritFlag);
            if( result ){
                return result;
            }
        }
        return null;
    }

    getImportDeclarations(){
        return this.getStacks().map(stack=>stack._imports||[]).flat()
    }

    get implements(){
        return this._implements;
    }

    set implements(value){
        if( Array.isArray(value) ){
            this._implements=value;
        }
    }

    addImplement(value){
        if(!this._implements.includes(value)){
            this._implements.push(value);
        }
    }

    isRemoved(name, descriptor){
        if(!descriptor)return false;
        if(descriptor && descriptor.isStack && descriptor.isRemoved){
            return true;
        }
        if(this.removedNamedDescriptors[name]){
            return this.removedNamedDescriptors[name].some( item=>{
                return !!descriptor.static === !!item.static;
            })
        }
        if(this.extends.some( item=>item.isRemoved(name,descriptor))){
            return true;
        }
        if(this.implements.some( item=>item.isRemoved(name,descriptor))){
            return true;
        }
        if(this.getUsingExtendsModules().some(item=>item.isRemoved(name,descriptor))){
            return true;
        }
        return false;
    }

    isDeprecated(name, descriptor){
        if(!descriptor)return false;
        if(descriptor && descriptor.isStack && descriptor.isDeprecated){
            return true;
        }
        if(this.deprecatedNamedDescriptors[name]){
            return this.deprecatedNamedDescriptors[name].some( item=>{
                return !!descriptor.static === !!item.static;
            });
        }
        if(this.extends.some( item=>item.isDeprecated(name,descriptor))){
            return true;
        }
        if(this.implements.some( item=>item.isDeprecated(name,descriptor))){
            return true;
        }
        if(this.getUsingExtendsModules().some(item=>item.isDeprecated(name,descriptor))){
            return true;
        }
        return false;
    }

    getUsingExtendsModules(){
        const result = [];
        const fetch = (usingExtends)=>{
            if( usingExtends && usingExtends.length > 0 ){
                for(let i=0; i<usingExtends.length;i++){
                    const ctx = usingExtends[i];
                    for(let b=0;b<ctx.extends.length;b++){
                        const ext = ctx.extends[b];
                        if(ext.module && ext.module!==this && !result.includes(ext.module)){
                            if(!this.extends.includes(ext.module) && !this.implements.includes(ext.module)){
                                result.push(ext.module)
                            }
                        }
                    }
                }
            }
        }
        fetch(this.callMethods);
        fetch(this.callMembers);
        return result;
    }

    addDescriptor(name, descriptor){
        let dataset = this.descriptors.get(name);
        if( !dataset ){
           dataset = [];
           this.descriptors.set(name, dataset);
        }
        dataset.push(descriptor);
        return true;
    }

    compareDescriptor(left, right){
        if(!left || !right)return false;
        const token = right.toString();
        if( left.isPropertyDefinition ){
            if( token ==='PropertyDefinition' ){
                const oldT = left.type();
                const newT = right.type();
                if( oldT && newT ){
                    return Utils.checkTypeForBoth(oldT.type(), newT.type());
                }
            }
        }else if( left.isMethodGetterDefinition ){
            if( token ==='MethodGetterDefinition' ){
                const oldT = left.getReturnedType();
                const newT = right.getReturnedType();
                if( oldT && newT ){
                    return Utils.checkTypeForBoth(oldT.type(), newT.type());
                }
            }
        }else if( left.isMethodSetterDefinition ){
            if( token ==='MethodSetterDefinition' ){
                const oldP = left.params[0];
                const newP = right.params[0];
                if( oldP && newP ){
                    const oldG = left.genericity;
                    const newG = right.genericity;
                    if(Boolean(oldG) !== Boolean(newG))return false;
                    if(oldG && newG && oldG.elements.length !== newG.elements.length)return false;
                    return Utils.checkTypeForBoth(oldP.type(), newP.type());
                }
            }
        }else if( left.isMethodDefinition ){
            if( right.isMethodDefinition ){
                const oldP = left.params;
                const newP = right.params;
                if(oldP && newP && oldP.length === newP.length){
                    const oldG = left.genericity;
                    const newG = right.genericity;
                    if(Boolean(oldG) !== Boolean(newG))return false;
                    if(oldG && newG && oldG.elements.length !== newG.elements.length)return false;
                    const oldR = left.getReturnedType();
                    const newR = right.getReturnedType();
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
            }
        }
        return false;
    }

    checkDescriptors(descriptors){
        if( descriptors && descriptors.length > 1 ){
            const sameitems = [];
            const push=(desc, result)=>{
                if( result ){
                    sameitems.push(...desc);
                }
                return result;
            }
            const result = descriptors.every( descriptor=>{
                const has = descriptors.some( item=>{
                    if(item=== descriptor)return false;
                    if( !!descriptor.static != !!item.static)return false;
                    if( !item.isSameSource(descriptor) )return false;
                    return push([descriptor, item], this.compareDescriptor(item, descriptor))
                });
                return !has;
            });
            return [result, sameitems]
        }
        return [true, []];
    }

    ckeckAllDescriptors(){
        this.descriptors.forEach( (list, name)=>{
            list.forEach(item=>{
                if(item.isRemoved){
                    const removed = this.removedNamedDescriptors[name] || (this.removedNamedDescriptors[name]=[])
                    removed.push(item);
                }
                if(item.isDeprecated){
                    const deprecated = this.deprecatedNamedDescriptors[name] || (this.deprecatedNamedDescriptors[name]=[])
                    deprecated.push(item)
                }
            });
            const [result, sameitems] = this.checkDescriptors(list);
            if( !result ){
                sameitems.forEach( desc=>{
                    desc.error(1045,name);
                });
            }
        });
    }

    isCallable(){
        if(this.callable)return true;
        return !!this.getDescriptor(`#${this.id}`);
    }

    getDescriptor(name, filter, ctx={}, defaultResult=null){
        //优先匹配在命名空间中声明的变量接口
        // if(this.isInterface && ('constructor' === name || name === `#${this.id}`)){
        //     const key = 'constructor' === name ? this.id : `#${this.id}`;
        //     const descriptors = this.namespace.descriptors.get(key);
        //     if(descriptors && descriptors.length > 0){
        //         let result = null;
        //         for(let i=0;i<descriptors.length;i++){
        //             const desc = descriptors[i];
        //             if(desc.isDeclaratorVariable){
        //                 const value = filter(desc, result, i, descriptors);
        //                 if(value){
        //                     if(value === true){
        //                         return desc;
        //                     }else{
        //                         result = value;
        //                     }
        //                 } 
        //             }
        //         }
        //         if(!defaultResult && result){
        //             const type = result.type();
        //             if('constructor' === name){
        //                 if(type && type.isLiteralObjectType && type.getDescriptor("#new#")){
        //                     defaultResult = result;
        //                 }else if(type && type.isInterface && type.getDescriptor("constructor")){
        //                     defaultResult = result;
        //                 }
        //             }else{
        //                 if(type && type.isLiteralObjectType && type.getDescriptor("#call#")){
        //                     defaultResult = result;
        //                 }else if(type && type.isInterface && type.getDescriptor(`#${this.id}`)){
        //                     defaultResult = result;
        //                 }
        //             }
        //         }
        //     }
        // }
        var isBreak = false;
        var cache = null;
        let isPound = name==='#'+this.id;
        const findExtends = (name, usingExtends, result=null)=>{
            if( isBreak )return result;
            if( usingExtends && usingExtends.length > 0 ){
                cache = cache || new WeakSet();
                for(let i=0; i<usingExtends.length;i++){
                    const ctx = usingExtends[i];
                    for(let b=0;b<ctx.extends.length;b++){
                        const ext = ctx.extends[b];
                        const classModule = ext.module;
                        if( !cache.has(classModule) && Utils.isModule(classModule)){
                            cache.add(classModule);
                            result = findAll(name, classModule, result, ctx);
                            if( isBreak ){
                                return result;
                            }
                        }
                    }
                }
            }
            return result;
        }

        const findAll = (name, module, result=null, extendsContext=null, isSelf=false)=>{
            module = module.type();
            if( name==="*" ){
                const keys = Array.from(module.descriptors.keys());
                for(let index=0;index<keys.length;index++){
                    result = findAll(keys[index], module, result, extendsContext, isSelf);
                    if( result && !filter)return result;
                    if( isBreak )return result;
                }
                return result;
            }
            const dataset = module.descriptors.get(name);
            if( dataset ){
                if( !filter ){
                    return dataset[0] || result;
                }else{
                    if( !dataset[symbolKey] ){
                        dataset[symbolKey] = true;
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
                            if(!a.isMethodDefinition){
                                if(!b.isMethodDefinition)return 0;
                                return 1;
                            }
                            if(!b.isMethodDefinition){
                                if(!a.isMethodDefinition)return 0;
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
                    }
                    
                    for(let i=0;i<dataset.length;i++){
                        const desc = dataset[i];
                        if( !isSelf && Utils.isModifierPrivate(desc) ){
                            continue;
                        }
                        const value = filter(desc, result, i, dataset, extendsContext);
                        if( value ){
                            if(value === true){
                                isBreak = true;
                                return desc;
                            }else{
                                result = value;
                            }
                        }
                    }
                }
                if( 'constructor' === name ){
                    return result
                }
            }

            const items = module.extends.concat( module.implements );
            for( let i=0; i<items.length;i++){
                const mod = items[i];
                if(Utils.isModule(mod)){
                    result = findAll( isPound ? `#${mod.id}` : name, mod, result, extendsContext);
                    if( isBreak ){
                        return result;
                    }
                }
            }

            if( 'constructor' !== name ){
                result = findExtends(name, module.callMethods, result);
                if( !isBreak ){
                    result = findExtends(name, module.callMembers, result);
                }
            }

            return result;
        }

        let result = findAll(name, this, defaultResult, null, true);
        if( result || 'constructor' === name ){
            return result;
        }

        result = findExtends(name, this.callMethods, result);
        if( !isBreak ){
            result = findExtends(name, this.callMembers, result);
        }
        
        if( result ){
            return result;
        }

        const base = Namespace.globals.get('Object');
        return base && base !== this ? findAll(name, base ) : null;
    }

    get isDeclaratorModule(){
        const value = this[symbolKey].isDeclaratorModule;
        if(value != null)return value;
        const stacks = this.getStacks()
        if(stacks.length>0){
            return this[symbolKey].isDeclaratorModule = stacks.every( stack=>{
                return stack.isDeclaratorDeclaration; //|| stack.isStructTableDeclaration
            })
        }else if(this.compilation){
            return this.compilation.isDescriptorDocument()
        }
        return false
    }

    get isLocalModule(){
        const value = this[symbolKey].isLocalModule;
        if(value != null)return value;
        const stacks = this.getStacks()
        if(stacks.length>0){
            return this[symbolKey].isLocalModule = stacks.some( stack=>{
                return stack.compilation.isLocalDocument();
            })
        }else if(this.compilation){
            return this.compilation.isLocalDocument()
        }
        return false;
    }

    get comments(){
        const comments = this[symbolKey].comments;
        if(comments)return comments;
        return this[symbolKey].comments = this[symbolKey].stacks.map( stack=>stack.comments ).flat();
    }

    isEntityModule(){
        if(this.isDeclaratorModule){
            //在声明模块时有指定导入源与模块同名的则表示为实体文件。
            return this.getImportDeclarations().some( item=>{
                if(item.isImportDeclaration && item.source.isLiteral){
                    return item.specifiers.some(spec=>spec.value() === module.id)
                }
                return false;
            });
        }
        return true;
    }

    clear( compilation ){
        const isSelf = !compilation || this.getStacks(true).some(stack=>stack.compilation === compilation);
        if(!compilation)compilation = this.compilation;
        if(isSelf){
            Logger.print(`clear: ${this.getName()}, file:${compilation ? compilation.file : this.file}`, 'module')
            this.imports = new Map();
            this.importAlias = new Map();
            this._implements.length = 0;
            this._extends = null;
            // this.static = false;
            // this.abstract = false;
            // this.isFinal = false;
            // this.isClass  = false;
            // this.isInterface  = false;
            // this.isEnum  = false;
            this.methodConstructor = null;
            this.dynamic=null;
            this.isFragment = false;
            this.isValid = false;
            this.jsxDeclaredSlots = null;
            this.making = false;
            this.dependencies = new Set()
            this.metadataFlags = 0;
            this[symbolKey].comments = void 0;
            this[symbolKey].isLocalModule = void 0;
            this[symbolKey].isDeclaratorModule = void 0;
        }

        this.dynamicProperties.forEach( (desc,key)=>{
            if(desc.compilation === compilation){
                this.dynamicProperties.delete(key);
            }
        });

        this.assets.forEach((desc,key)=>{
            if(desc.stack && desc.stack.compilation === compilation){
                this.assets.delete(key);
            }
        });

        this.requires.forEach((desc,key)=>{
            if(desc.stack && desc.stack.compilation === compilation){
                this.requires.delete(key);
            }
        })

        const clearMember = (key,target)=>{
            const dataset = target[key];
            if(!dataset)return;
            if(dataset.isAccessor){
                if(dataset.get && dataset.get.compilation===compilation){
                    delete dataset.get;
                }
                if(dataset.set && dataset.set.compilation===compilation){
                    delete dataset.set;
                }
                if(!(dataset.set || dataset.get)){
                    delete target[key]
                }
            }else if( dataset.compilation === compilation ){
                delete target[key]
            }
        }

        const clearList = (list, callback)=>{
            if(!Array.isArray(list))return;
            for(let i=0;i<list.length;){
                const desc = list[i];
                if(desc.compilation === compilation){
                    list.splice(i, 1);
                    if(callback)callback(desc);
                }else{
                    i++;
                }
            }
        }

        this.descriptors.forEach( (items,key)=>{
            clearList(items,(desc)=>{
                clearMember(key,  desc.static ? this.methods : this.members);
            });
        });

        clearList(this.metatypes);
        clearList(this.annotations);

        const clearExtend = (extendMethods)=>{
            const len = extendMethods.length;
            for(let index = 0; index<len;index++){
                const item = extendMethods[index];
                const methods = item.methods;
                const dynamic = item.dynamic;
                if(methods){
                    Object.keys(methods).forEach( key=>{
                        clearMember(key, methods)
                    })
                }
                clearList(dynamic);
            }
        }

        clearExtend(this.callMethods);
        clearExtend(this.callMembers);

        const clearCache = (target)=>{
            if(!target)return;
            Object.keys(target).forEach( (key)=>{
                clearList(target[key])
            })
        }
        clearCache(this.removedNamedDescriptors);
        clearCache(this.deprecatedNamedDescriptors);
        clearCache(this.annotationDescriptors);

        const stacks = this[symbolKey].stacks;
        if(stacks){
            if(this.required){
                if(stacks.some( stack=>stack.isAnnotationDeclaration && stack.compilation === compilation)){
                    this.required = false;
                }
            }
            clearList(stacks);
        }
    }

    addAsset(resolve,file,content,type,assign,attrs=null,stack=null){
        let key = resolve;
        const old = this.assets.get(key)
        const cacheId = this.compilation.cacheId
        if(!old){
            const obj = {
                file,
                resolve,
                content,
                type,
                assign,
                id:this.getName(),
                index:this.assets.size,
                attrs,
                cacheId,
                stack
            };
            this.assets.set(key, obj);
            return obj;
        }else if( old.cacheId !== cacheId ){
            old.cacheId = cacheId
            return old
        }
        return false
    }

    addRequire(key,name,from,resolve,extract,stack=null,isAutoImporter=false){
        let cacheKey = name+':'+resolve;
        let old = this.requires.get(cacheKey)
        const cacheId = this.compilation.cacheId
        if( !old ){
            const obj = {
                key,
                name,
                from,
                resolve,
                extract,
                stack,
                isAutoImporter,
                namespaced:key==="*",
                id:this.getName(),
                cacheId,
                index:this.requires.size
            };
            this.requires.set(cacheKey,obj);
            return obj;
        }else if( old.cacheId !== cacheId ){
            old.cacheId = cacheId
            return old
        }
        return false
    }

    getModuleKind(){
        return this.isInterface ? "interface" : this.isEnum ? "enum" : this.isStructTable ? 'struct' : "class";
    }

    definition(context){
        return this.getStacks().map(stack=>stack.definition(context))
    }

    hover(context){
        let stacks = this.getStacks();
        if(stacks.length>0){
            let stack = stacks[0];
            let def = stack.hover(context);
            let items = stacks.slice(1).map(stack=>stack.hover(context));
            return stack.formatHover(def, items);
        }
        let kind = this.getModuleKind();
        return {
            text:`${kind} ${this.getName()}`
        }
    }

    getName(segment='.'){
        if(segment==='.'){
            return this.getFullName();
        }
        let name = this.id;
        if( this.namespace ){
            name = this.namespace.getChain().concat(this.id).join( segment )
        }
        return name;
    }

    getFullName(){
        let fullname = this.fullname;
        if( fullname ){
            return fullname;
        }
        let name = this.id;
        if( this.namespace ){
            name = this.namespace.getChain().concat(name).join('.')
        }
        return this.fullname = name;
    }

    getInheritModule(){
        const inherit = this.inherit;
        if(inherit){
            return inherit.type();
        }
        return null;
    }

    type(){
        if(!this.isValid){
            return this.namespace.get(this.id) || this;
        }
        return this;
    }

    is( type, context ){
        if(!this.isValid){
            const newType = this.type();
            if(newType !== this){
                return newType.is(type, context);
            }
        }
        if(!Utils.isType(type))return false;
       
        type = this.inferType(type, context);

        if( type.isUnionType ){
            return type.elements.every( item=>this.is(item.type(), context) );
        }
        
        if( !this.isNeedCheckType(type) )return true;
        if( this.id==="Interface" && (!this.namespace || this.namespace.identifier==='') && Utils.isInterface(type) ){
            return true;
        }

        if( type.isEnumType ){
           return type.owner === this || type.inherit === this || type.inherit.is(this, context);
        }

        if(this.isEnum && type.isLiteralType){
            const members = this.methods;
            for(let key in members){
                const item = members[key];
                if(item && item.isEnumProperty && item.init && item.init.value() === type.value){
                    return true
                }
            }
            let inherit = this.getInheritModule();
            if(inherit){
                inherit = inherit.type();
            }
            return inherit && inherit.isEnum ? inherit.is(type, context) : false;
        }

        if( type.isIntersectionType ){
            return this.is( type.left.type(), context ) ? true : this.is( type.right.type(), context );
        }
        
        const nullType = Namespace.globals.get("nullable");
        const objectType = Namespace.globals.get("Object");
        const classType = Namespace.globals.get("Class");

        if( this === objectType && !Utils.isScalar( type ) ){
            return true;
        }

        if( this === classType ){
            if( type.isClassGenericType && type.extends[0]){
                type = type.extends[0].type();
            }
            return type === this || !!(type instanceof Module && type.isClass);
        }

        if( (this.isInterface || this.isStructTable) && type.isLiteralObjectType ){
            const dynamic = this.dynamicProperties;
            if( dynamic && dynamic.size > 0){
                return dynamic.has(Namespace.globals.get("string"));
            }
            const properties = Object.keys( this.members );
            const errorHandler = context && context.errorHandler || ((result)=>result);
            const result = properties.every( propName=>{
                const attr = type.attribute( propName );
                let property = this.members[propName];
                if(property.isAccessor){
                    if(property.set && property.set.isMethodSetterDefinition){
                        if(!attr)return !!property.set.question;
                        const param = property.set.params[0];
                        if(param){
                            const acceptType = param.type();
                            if(!errorHandler(acceptType.check(attr, context), acceptType, attr.key, attr.type())){
                                return false;
                            }
                        }
                    }
                    if( property.get && property.get.isMethodGetterDefinition){
                        if(!attr)return !!property.get.question;
                        const acceptType = property.get.type();
                        if(!errorHandler(acceptType.check(attr, context), acceptType, attr.key, attr.type())){
                            return false;
                        }
                    }
                    return true;
                }
                if( attr ){
                    const acceptType = property.type();
                    return errorHandler(acceptType.check(attr, context), acceptType, attr.key, attr.type());
                }
                return !!property.question;
            });
            
            if( !result )return false;
            if( this.extends.length > 0 && !this.extends.every( item=>{
                const mType = item.type();
                return mType !== this && mType.is( type );
            })){
                return false;
            } 
            if( this.implements.length > 0 && !this.implements.every( item=>item.type().is( type ) ) ){
                return false;
            }
            return true;
        }
        
        type = Utils.getOriginType( type );
        if(type === nullType || type === this ){
            return true;
        }

        if(!Module.is(type)){
            return false;
        }

        if(this.isInterface && type.id ==='Array'){
            const result = this.getDescriptor('length', (desc)=>!!desc.isPropertyDefinition)
            if(result && result.isPropertyDefinition ){
                return true;
            }
        }

        if(this[symbolKey]._processing === type){
            return this.toString()===type.toString();
        }
        this[symbolKey]._processing = type;

        const check = (left, right, notCheckProperty=false)=>{
            if(!right || !left)return false;
            left = left.type();
            right = right.type();
            if(left=== right){
                return true;
            }
            if(right.extends.some(right=>check(left, right))){
                return true;
            }
            if(right.implements && right.implements.length > 0){
                if(right.implements.some(right=>check(left,right)) ){
                    return true;
                }
            }
            if(!notCheckProperty && !this[symbolKey].checkImpls && left.isInterface && right.members){
                const properties = Object.keys( left.members );
                const errorHandler = context && context.errorHandler || ((result)=>result);
                const _check = (leftMember, rightMember)=>{
                    if( rightMember ){
                        const acceptType = leftMember.type();
                        return errorHandler(acceptType.check(rightMember, context), acceptType, rightMember.key, rightMember.type());
                    }
                    return !!leftMember.question;
                };
                const result = properties.every( propName=>{
                    let rightMember = right.members[propName];
                    let leftMember = left.members[propName];
                    if( leftMember.isAccessor || rightMember && rightMember.isAccessor ){
                        if( rightMember ){
                            if(rightMember.isAccessor && !leftMember.isAccessor)return false;
                            if( !rightMember.isAccessor  )return false;
                            if( leftMember.get && !_check(leftMember.get,rightMember.get) ){
                                return false;
                            }
                            if( leftMember.set && !_check(leftMember.set, rightMember.set) ){
                                return false;
                            }
                            return true;
                        }else{
                            return [leftMember.get,leftMember.set].every( item=>item ? _check(item) : true);
                        }
                    }
                    return _check(leftMember, rightMember);
                });
                if( left.dynamicProperties && left.dynamicProperties.size >0 ){
                    if(!(right.dynamicProperties && right.dynamicProperties.size > 0))return false;
                    const keys = left.dynamicProperties.keys();
                    for(let key of keys){
                        if(!right.dynamicProperties.has(key.type())){
                            return false;
                        }
                    }
                }
                if(result)return true;
            }
            return false;
        }
        let _res = check(this,type) || check(type, this, true);
        this[symbolKey]._processing = null;
        return _res;
    }

    isof(type, context){
        this[symbolKey].checkImpls = true;
        let result = this.is( type, context );
        this[symbolKey].checkImpls = false;
        return result;
    }

    publish(){
        const alias = this.metatypes.find( item=>item.name==="Alias" );
        if( alias ){
            const metatype = {};
            alias.params.forEach( item=>{
                const name  = item.value ? item.name : "name";
                const value = item.value ? item.value : item.name;
                metatype[ name ] = value;
            });
            this.alias = metatype.name;
            this.namespace.set(metatype.name, this);
            if( Boolean(metatype.origin) !== false ){
               this.namespace.set(this.id, this);
            }
        }else{
            this.namespace.set(this.id, this);
        }
    }

    getUseExtendMethod(name, kind, isStatic){
        const extendMethods = isStatic ? this.callMethods : this.callMembers;
        const len = extendMethods.length;
        for(let index = 0; index<len;index++){
            const item = extendMethods[index];
            const methods = item.methods;
            const dynamic = item.dynamic;
            let result = null;
            if( methods && Object.prototype.hasOwnProperty.call(methods,name) ){
                let desc = methods[name];
                if( desc.isAccessor ){
                    desc = kind =="set" ? desc.set : desc.get;
                }
                if(desc){
                    if( !isStatic && !desc.static ){
                        return desc;
                    }else if( isStatic ){
                        return desc;
                    }
                }
            }
            const _extends = item.extends;
            const _len = _extends.length;
            for(let i=0;i<_len;i++){
                const target = _extends[i];
                const classModule = target && target.module ? target.module.type() : null;
                if( classModule && Utils.isModule(classModule)){
                    result = target.mode==='class' ? classModule.getMethod(name, kind) : classModule.getMember(name, kind);
                    if( result ){
                        if( target.modifier.length > 0 ){
                            if( target.modifier.includes( Utils.getModifierValue( result ) ) ){
                                return result;
                            }
                        }else{
                            return result;
                        }  
                    }
                }
            }
            
            if( dynamic && dynamic.length > 0 ){
                const stringType = Namespace.globals.get('String');
                result = stringType ? dynamic.find( method=>{
                    if( method.isMethodDefinition && method.dynamicType ){
                        const acceptType = method.dynamicType;
                        return acceptType && stringType.is( acceptType.type() );
                    }
                    return false;
                }) : false;
                if( result ){
                    return result;
                }
            }
        }

        const imps = this.extends.concat( this.implements );
        const total= imps.length;
        for(let i=0;i<total;i++){
            let module = imps[i];
            module = module.type();
            if( module && module !== this && Utils.isModule(module) && !(this.namespace === module.namespace && this.id === module.id) ){
                if( !module.extends.includes(this) ){
                    const result = module.getUseExtendMethod(name, kind, isStatic);
                    if( result ){
                        return result;
                    }
                }
            }
        }

        return null;
    }

    getAnnotationCallMethodAllConfig( isMember = true ){
        const data = isMember ? this.callMembers.slice(0) : this.callMethods.slice(0);
        const imps = this.extends.concat(this.implements);
        const total = imps.length;
        for(let i=0;i<total;i++){
            let module = imps[i]
            module = module.type();
            if( module && module !== this && Utils.isModule(module) && !(this.namespace === module.namespace && this.id === module.id) ){
                if( !module.extends.includes(this) ){
                    data.push( ...module.getAnnotationCallMethodAllConfig(isMember) );
                }
            }
        }
        return data;
    }

    getAnnotationCallMethods( isMember = true ){
        const configs = this.getAnnotationCallMethodAllConfig( isMember );
        const len = configs.length;
        const properties = new Set();
        const excludes = isMember ? this.getMemberKeys() : Object.keys(this.methods);
        const merge=(classModule, mode, modifier, methods)=>{
            if(!classModule || classModule === this)return;
            const dataset = mode==='class' ? classModule.methods : classModule.members;
            for(let name in dataset){
                if( excludes.includes(name) )continue;
                if( methods && Object.prototype.hasOwnProperty.call(methods, name))continue;
                let desc = dataset[name];
                if( desc.isAccessor ){
                    if(desc.get)properties.add(desc.get);
                    if(desc.set)properties.add(desc.set);
                }else{
                    properties.add(desc);
                }
            }
            classModule.extends.concat( classModule.implements ).forEach( item=>merge(item.type(), mode, modifier) );
        }
        for(let index = 0; index<len;index++){
            const item = configs[index];
            const methods = item.methods;
            for(let name in methods){
                let desc = methods[name];
                if( desc.isAccessor ){
                    if(desc.get)properties.add(desc.get);
                    if(desc.set)properties.add(desc.set);
                }else{
                    properties.add(desc);
                }
            }
            item.extends.forEach( specifier=>{
                const module = specifier.module;
                const mode = specifier.mode;
                const modifier = specifier.modifier;
                if( module ){
                    merge(module.type(), mode, modifier, methods);
                }
            });
        }
        return Array.from( properties );
    }

    getMethod( name, kind=null){
        const target = Object.prototype.hasOwnProperty.call(this.methods,name) ? this.methods[name] : null;
        if( target && target.isAccessor ){
            return kind =="set" ? target.set : target.get;
        }
        if( !target ){
            return this.getUseExtendMethod(name, kind, true);
        }
        return target;
    }

    hasMember( name ){
        const members = this.members;
        if( Object.prototype.hasOwnProperty.call(members,name) ){
           return true
        }

        for(var i=0; i<this.extends.length;i++){
            const inherit = this.extends[i].type();
            if( inherit !== this && Utils.isModule(inherit) && !inherit.extends.includes(this) ){
                const result = inherit.hasMember(name);
                if( result ){
                    return true;
                }
            }
        }

        const result = this.hasInterfaceMember(name);
        if( result ){
            return true;
        }

        const base = Namespace.globals.get("Object");
        if( base && base !== this ){
            const result = base.hasMember(name);
            if( result ){
                return true;
            }
        }
        return false;
    }


    getMember( name, kind=null, excludeInterface=false, useExtendFlag=true){
        const members = this.members;
        if( Object.prototype.hasOwnProperty.call(members,name) ){
            const target = members[name];
            if( target && target.isAccessor ){
                return kind =="set" ? target.set : target.get;
            }
            return target;
        }

        for(var i=0; i<this.extends.length;i++){
            let inherit = this.extends[i];
            inherit = inherit ? inherit.type() : null;
            if( inherit !== this ){
                if(Utils.isModule(inherit) && !inherit.extends.includes(this) ){
                    const result = inherit.getMember(name, kind, excludeInterface, useExtendFlag);
                    if( result ){
                        return result;
                    }
                }
            }
        }

        const result = excludeInterface ? null : this.getInterfaceMember(name, kind);
        if( result ){
            return result;
        }

        const base = Namespace.globals.get("Object");
        if( base && base !== this ){
            const result = base.getMember(name, kind, excludeInterface, useExtendFlag);
            if( result ){
                return result;
            }
        }
        if(useExtendFlag){
            return this.getUseExtendMethod(name, kind);
        }
        return null
    }

    dynamicAttribute(propertyType, context=null){
        const properties = this.dynamicProperties;
        for(let [key, value] of properties){
            if( key.check(propertyType, context) ){
                return value;
            }
        }
        const inherit =  this.inherit;
        if( inherit && inherit !== this && Utils.isModule(inherit) && !inherit.extends.includes(this) ){
            const result = inherit.dynamicAttribute( propertyType, context);
            if( result ){
                return result;
            }
        }
        if( this.implements ){
            for(const impl of this.implements ){
                const result = Utils.isModule(impl) && impl.dynamicAttribute( propertyType, context);
                if( result ){
                    return result;
                }
            }
        }
        return null;
    }

    getMemberKeys(){
        const members = this.members;
        const keys = Object.keys(members);
        for(var i=0; i<this.extends.length;i++){
            let inherit = this.extends[i];
            inherit = inherit.type();
            if( inherit && inherit !== this && Utils.isModule(inherit) && !inherit.extends.includes(this) ){
                keys.push( ...inherit.getMemberKeys() );
            }
        }
        if( this.implements ){
            for(const impl of this.implements ){
                keys.push( ...impl.getMemberKeys() );
            }
        }
        return keys;
    }

    getTypeKeys(){
       return Array.from(this.getProperties().keys());
    }

    getProperties(propertyMap){
        propertyMap = propertyMap || new Map();
        let members = this.members;
        for(var name in members ){
            let member = members[name];
            if( member.isAccessor )member = member.get;
            if( member){
                const modifier = Utils.getModifierValue( member );
                if( modifier ==="public" ){
                    propertyMap.set(name, member);
                }
            }
        }
        const inherit =  this.inherit;
        if( inherit && inherit !== this && Utils.isModule(inherit) && !inherit.extends.includes(this) ){
            inherit.getProperties( propertyMap );
        }
        if( this.isInterface ){
            this.implements.forEach( imp=>imp.getProperties(propertyMap) );
        }
        return propertyMap;
    }


    getInterfaceMember(name, kind=null){
        const imps = this.implements;
        const len  = imps.length;
        for(let i=0;i<len;i++){
            let impModule = imps[i];
            impModule = impModule ? impModule.type() : null;
            if( impModule && impModule !== this && Utils.isModule(impModule) && !impModule.extends.includes(this) ){
                const result = impModule.getMember(name, kind);
                if( result ){
                    return result;
                }
            }
        } 
        return null;
    }

    hasInterfaceMember(name){
        const imps = this.implements;
        const len  = imps.length;
        for(let i=0;i<len;i++){
            let impModule = imps[i];
            impModule = impModule.type();
            if( impModule && impModule !== this && Utils.isModule(impModule) && !impModule.extends.includes(this) ){
                const result = impModule.hasInterfaceMember(name);
                if( result ){
                    return true;
                }
            }
        } 
        return false;
    }

    getConstructMethod(flag){
        if( !flag ){
            return this.methodConstructor || null;
        }
        let inherit = this;
        while( inherit ){
            let method = inherit.methodConstructor;
            if( method ){
               return method;
            };
            inherit = inherit.getInheritModule();
        }
        return null;
    }

    addDepend(module){
        if( module !== this ){
            module.used = true;
            this.dependencies.add(module);
        }
    }

    getReferenceNameByModule(module, flag=false){
        if(!module || !module.isModule)return null;
        if( module === this ){
           return module.id 
        }

        if( this.importAlias.has(module) ){
            return this.importAlias.get(module);
        }
       
        if( module.required || this.imports.has( module.id ) ){
            return module.id;
        }

        const req = this.requires.get(module.id);
        if(req && req.isAutoImporter){
            return req.name;
        }

        if(module.compilation === this.compilation && this.compilation.modules.has(module.getName())){
            return module.id;
        }

        const stacks = this.getStacks(true);
        for(let i=0;i<stacks.length;i++){
            const stack = stacks[i];
            if(stack && stack.isClassDeclaration){
                const compi = stack.compilation;
                if(compi && !compi.isDestroyed){
                    if(compi.importModuleNameds.has(module)){
                        return compi.importModuleNameds.get(module);
                    }
                }
            }
        }

        if(flag){
            return null;
        }

        return module.namespace.getChain().concat(module.id).join("_");
    }


    addMember(name, desc, flag=false){
        if(desc && desc.isConstructor){
            const result = this.addDescriptor('constructor', desc);
            if( !result ){
                if( this.methodConstructor && desc.isSameSource(this.methodConstructor) ){
                    desc.error(1045,'constructor');
                }
            }
            this.methodConstructor =  desc;
        }else{
            this.addDescriptor(name, desc);
            const isStatic = !!(desc.static || this.static);
            const target = isStatic || flag ? this.methods : this.members;
            if( desc.kind ==="get" || desc.kind ==="set" ){
                const obj = Object.prototype.hasOwnProperty.call(target,name) ? target[ name ] : (target[ name ]={isAccessor:true});
                if(!this.isDeclaratorModule){
                    if( !obj.isAccessor && Utils.isStack(obj) ){
                        desc.error(1045,name);
                        obj.error(1045,name)
                    }
                }
                if(!obj[ desc.kind ] || !desc.isSameSource(obj[ desc.kind ])  ){
                    obj[ desc.kind ] = desc;
                }
            }else{
                if( !this.isDeclaratorModule ){
                    if( Object.prototype.hasOwnProperty.call(target,name) ){
                        let old = target[ name ];
                        if( old && old.toString() !== desc.toString() ){
                            desc.error(1045,name);
                            old.error(1045,name)
                        }
                    }
                }
                
                if( !target[ name ] || !desc.isSameSource(target[ name ]) ){
                    target[ name ] = desc;
                }
                
            }
        }
    }

    addImport(name, module, isAlias=false, topScope=null){
        if( module === this ){
            return false;
        }
        if( isAlias ){
            this.importAlias.set(module,name);
        }
        this.imports.set(name, module);
        return true;
    }

    getModuleAlias(module){
        if(Module.is(module) && this.importAlias.size>0){
            for(let m of this.importAlias.keys()){
                if(m.getName() === module.getName()){
                    return this.importAlias.get(m);
                }
            }
        }
        return null;
    }

    getImport(name){
        return this.imports.get(name);
    }

    getModuleGenerics(){
        const result = this.getModuleDeclareGenerics();
        return result.length>0 ? result : null;
    }

    getModuleDeclareGenerics(flag=false, onlyread=false, origin=false){
        const statcks = this.getStacks().filter( stack=>!!stack.genericity).sort((a,b)=>{
            let a1 = a.genericity.elements.length;
            let b1 = b.genericity.elements.length;
            return a1 > b1 ? -1 : a1 < b1 ? 1 : 0;
        });
        if(statcks.length>0){
            if(origin){
                return [statcks[0], statcks[0].genericity.elements];
            }
            if(flag){
                return [statcks[0], statcks[0].genericity.elements.map(item=>item.type())];
            }
            if(onlyread){
                return statcks[0].genericity;
            }
            return statcks[0].genericity.elements.map( item=>item.type() );
        }
        return [];
    }

    toString(context={}, options={}){
        if(!options.__recursion){
            options.__recursion = 0;
        }
        if(options.__recursion>20){
            return 'Circular';
        }
        options.__recursion++;

        const name = this.namespace.getChain().concat( this.id ).join(".");
        const stacks = this.getStacks();
        options.complete = false;
        if( context && context.stack){
            if( stacks.some( item=>item.id === context.stack) ){
                options.complete = true;
            }
        }

        const [stackModule, declareGenerics] = this.getModuleDeclareGenerics(true)
        if( stackModule && declareGenerics && declareGenerics.length>0){
            const ctx = context && context.isContext ? context : stackModule.getContext()
            const elements = declareGenerics.map( item=>{
                if(options.fetchDeclareGenericsDefaultValue && options.inbuild){
                    if(item.type().assignType){
                        return item.type().assignType.type().toString({}, Object.create(options)); 
                    }
                    return 'any';
                }
                const type = ctx.fetch(item.type(),true);
                if( type === this ){
                    return type.id;
                }
                if(options.complete){
                    return type.toString({}, Object.create(options));
                }else{
                    return stackModule.getTypeDisplayName(type, context, Object.create(options));
                }
            })
            options.__recursion = null;
            return `${name}<${elements.join(",")}>`
        }
        options.__recursion = null;
        return name;
    }
}
module.exports = Module;