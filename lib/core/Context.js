const Namespace = require('./Namespace');
const UnknownType = require('../types/UnknownType');
const Utils = require('./Utils');
const MergeType = require('./MergeType');
const InstanceofType = require('../types/InstanceofType');
const UKType = new UnknownType();
const privateKey = Symbol('privateKey');
var defaultInferType = null;
class Context{
    [Utils.IS_CONTEXT] = true;

    static is(value){
        return value && value instanceof Context;
    }

    static setDefaultInferType(type){
        if(type && type.isType){
            defaultInferType = type;
        }else{
            defaultInferType = null;
        }
    }

    constructor(stack){
        this.stack = stack;
        this.children = [];
        this.parent = null;
        this.dataset = new Map();
        this._declareGenerics = null;
        this.makeDoneCache = new WeakSet();
        this.applyResult = new Map();
        this.isContext = true;
        this.onSetValue = null;
        this._applyContext = {};
    }

    createChild(stack){
        const old = stack[privateKey];
        if(old)return old;
        const ctx = new Context(stack);
        stack[privateKey] = ctx;
        ctx.parent = this;
        this.children.push(ctx);
        return ctx;
    }

    hasDeclareGenerics(){
        if(this.stack.isFunctionExpression || this.stack.isClassDeclaration || this.stack.isDeclaratorDeclaration || this.stack.isInterfaceDeclaration){
            return !!this.stack.genericity;
        }else if(this.stack.isCallExpression || this.stack.isNewExpression){
            let desc = this.stack.description();
            if( desc ){
                if( desc.isMethodDefinition ){
                    desc = desc.expression;
                }
                if( desc.isFunctionExpression ){
                    return !!desc.genericity;
                }
                desc = desc.isDeclarator ? desc.type() : desc;
                if( Utils.isTypeModule(desc) ){
                    const stackModule = desc.moduleStack;
                    return !!(stackModule && stackModule.genericity);
                }
            }
        }
        return !!this.stack.isTypeGenericDefinition;
    }

    declareGenerics( declare ){
        // if( declare && declare.isGenericDeclaration ){
        //     this._declareGenerics = declare;
        //     declare.elements.forEach( item=>{
        //         const type = item.type();
        //         if(type.assignType){
        //             this.setValue(type, type.assignType)
        //         }else if( type.hasConstraint ){
        //             this.setValue(type, type.inherit)
        //         }else {
        //             this.setValue(type, UKType);
        //         }
        //     });
        // }
    }

    setValue(type, value){
        if( type && value){
            if(type.isGenericType){
                if(value.isGenericType){
                   const res = this.getValue(value, true);
                   if(res)value = res;
                }
                if(value.isTypeofType){
                    value = value.origin;
                }
                if(Utils.isStack(value) || Utils.isType(value)){
                    if(type !== value.type()){
                        this.dataset.set(type.getUniKey(), value);
                    }
                }
            }else{
                if(this.stack && this.stack.compiler){
                    const options = this.stack.compiler.options;
                    if(options.debug || options.throwError){
                        throw new Error(`Assigment type is not generic-type`);
                    }
                }
            }
        }
    }

    getValue(type, flag=false){
        if(!type || !type.isGenericType)return null;
        let result = this.dataset.get(type.getUniKey()) || null;
        if(type === result){
            result = null;
        }
        if( flag && !result ){
            if( this.parent ){
                return this.parent.getValue(type, flag);
            }
        }
        return result;
    }

    batch(declares, assignments){
        if( declares && declares.length > 0 && assignments && assignments.length > 0){
            declares.forEach( (declare,index)=>{
                const value = assignments[index];
                if( value ){
                    this.setValue(declare, value);
                }
            });
        }
    }

    merge( context ){
        if(context instanceof Context){
            context.dataset.forEach( (value, key)=>{
                const old = this.dataset.get(key);
                if(old && old !== UKType)return;
                this.dataset.set(key, value);
            })
        }else{
            throw new Error(`Argument context is not Context instanced.`);
        }
    }

    mergeAll( context ){
        if(!context)return null;
        if(context instanceof Context){
            context.dataset.forEach( (value, key)=>{
                if(!this.dataset.has(key) && value !== UKType){
                    this.dataset.set(key, value);
                }
            });
            if(context.parent){
                this.mergeAll( context.parent );
            }
        }else{
            throw new Error(`Argument context is not Context instanced.`);
        }
    }

    assignment(type,callback=null, excludes=null){
        if(!type)return;
        if(excludes && excludes.has(type)){
            return;
        }
        if(type.isTypeofType)type = type.origin.type();
        if(type.isGenericType){
            let _type = type.assignType ? type.assignType.type() : type.hasConstraint ? type.inherit.type() : null;
            if(_type !== type){
                excludes = excludes || new WeakSet();
                excludes.add(type);
                return this.assignment(_type, callback, excludes);
            }else{
                return;
            }
        }
        if(type.isAliasType){
            if( type.target && type.target.isDeclaratorTypeAlias ){
                this.merge( type.target.getContext() )
            }
            const inherit = type.inherit;
            if( inherit && type !== inherit){
                this.assignment(inherit.type(),callback, excludes);
            }
            return;
        }

        const setValue=(assignments)=>{
            if( declareGenerics ){
                declareGenerics.forEach( (decl, index)=>{
                    let value = assignments[index];
                    if( value ){
                        decl = decl.type();
                        if(decl === value.type()){
                            value = decl.assignType;
                            if(!value)return;
                        }
                        if(callback){
                            callback(decl, value);
                        }else{
                            this.setValue(decl, value)
                        }
                    }
                });
            }
        };

        let originType = Utils.getOriginType(type);
        let [stack,declareGenerics] = this.getDeclareGenerics(type, originType);

        if(originType && originType.isModule){
            if(stack)this.merge(stack.getContext());
            originType.getStacks().forEach( item=>{
                if(stack !== item){
                    this.merge(item.getContext());
                }
            })
        }
       
        if(type.isTupleType || type.isLiteralArrayType){
            if(type.isTupleType){
                type.elements.forEach(item=>{
                    this.assignment(item.type(), callback, excludes)
                })
            }
            setValue([MergeType.to(type, true, true)]);
        }else if( type.isInstanceofType && type.generics && type.generics.length > 0 ){
            setValue(type.generics);
        }else if( type.isClassGenericType ){
            if( !type.isClassType ){
                const wrap = type.inherit.type();
                if( wrap.target && wrap.target.isDeclaratorTypeAlias && wrap.target.genericity ){
                    declareGenerics = wrap.target.genericity.elements;
                }   
            }
            type.types.forEach( assign=>{
                this.assignment(assign,callback, excludes);
            });
            setValue(type.types);

            // if( declareGenerics && declareGenerics.length > 0){
            //     this.dataset.forEach( (value, key)=>{
            //         const decl = value.type();
            //         const index = declareGenerics.indexOf( decl );
            //         if( index >= 0 ){
            //             const value = type.types[index];
            //             this.dataset.set(key, value);
            //         }
            //     })
            // }
        }
    }

    getDeclareGenerics(type, originType){
        if(type.isInstanceofType){
            type = type.inherit.type();
        }
        if(type.isAliasType && type.target && type.target.isDeclaratorTypeAlias && type.target.genericity){
            return [type.target, type.target.genericity.elements]
        }else 
        
        if( type.isClassGenericType && type.target && type.target.isTypeGenericDefinition){
            return type.target.getDeclareGenerics();
        }
        
        originType = originType || Utils.getOriginType(type);
        if(originType && originType.isModule){
            return originType.getModuleDeclareGenerics(true)
        }
        return []
    }

    make(type){
        if(!type)return false;
        if(this.makeDoneCache.has(type))return true;
        this.makeDoneCache.add(type);
        if(type.isTypeofType)type = type.origin.type();
        if( type.isIntersectionType ){
            this.make(type.left.type());
            this.make(type.right.type());
        }else if( type.isUnionType ){
            const dataset = new Map();
            type.elements.forEach( item=>{
                this.assignment(item.type(),(key, value)=>{
                    if(value.isTypeofType)value = value.origin.type();
                    let target = dataset.get(key);
                    if( !target ){
                        dataset.set(key, target=[value]);
                    }else{
                        target.push(value)
                    }
                })
            });
            dataset.forEach( (items, key)=>{
                if( items.length > 1 ){
                    const mergeType = new MergeType();
                    items.forEach(type=>mergeType.add(type));
                    this.setValue(key, mergeType.type())
                }else{
                    this.setValue(key, items[0])
                }
            });
        }else{
            this.assignment(type);
        }
        return true;
    }

    __fetch(type, flag=false, prev=null){
        if(!type)return null;
        if(!type.isGenericType)return type;
        let result = this.getValue(type);
        let value = result ? result.type() : null;
        if(value && value.isGenericType){
            if(value !== type && value !== prev){
                return this.__fetch(value, flag, value);
            }
        }else if((!result||value === UKType) && this.parent){
            return this.parent.__fetch(type, flag, prev||value);
        }
        if(!value){
            value = type.assignType;
            if(value){
                value = value.type();
                if(value && value.isGenericType && value !== type && value !== prev){
                    return this.__fetch(value, flag, prev);
                }
            }
        }
        if(!value && prev){
            value = prev
        }
        return flag && !value ? type : value;
    }

    fetch(type, flag=false){
        let result = this.__fetch(type, flag);
        if(!result || result===UKType){
            if(defaultInferType){
                result = defaultInferType;
            }
        }
        return result;
    }

    inferValue(type, flag=false){
        if(!type || !type.isGenericType)return type;
        let result = this.fetch(type);
        if(!result || result===UKType){
            result = type.hasConstraint ? type.inherit : result
        }
        if( result ){
            return result.type();
        }else if(flag){
            return UKType;
        }
        return null;
    }

    get inference(){
        return (type)=>{
            if(!type || !type.isGenericType)return type;
            let result = this.fetch(type);
            if(!result || result===UKType){
                this._applyContext.mismatch=true;
                result = type.hasConstraint ? type.inherit : result
            }
            if( result ){
                return result.type();
            }
            return type;
        }
    }
    
    apply(type, context={}){
        if(type && type.hasGenericType){
            this._applyContext = context;
            if(type.isGenericType){
                return this.fetch(type) || (this._applyContext.mismatch=true, type.hasConstraint ? type.inherit.type() : UKType);
            }
            if(this.applyResult.has(type)){
                return this.applyResult.get(type);
            }
            let result = type.clone(this.inference);
            if( type.isComputeType ){
                result = result.getComputeType()
            }
            this.applyResult.set(type, result);
            return result;
        }
        return type;
    }

    isObjectType(type){
        if(!type)return false;
        return type.isLiteralObjectType || 
                type.isInstanceofType || 
                type.isEnumType || 
                (type.isEnum && type.isModule);
    }

    extracts(declareParams, assignments, declareGenerics, parserFlag=false){
        // if(declareGenerics && Array.isArray(declareGenerics)){
        //     declareGenerics.forEach( declare=>{
        //         const declared = declare.type();
        //         const assignType = declared.assignType;
        //         if( assignType ){
        //             this.setValue(declared, assignType);
        //         }
        //     });
        // }

        const cache = new Map();
        const onSetValue = (decl, assignValue, context=[])=>{
            const old = cache.get(decl);
            if(old){
                if(old[0]==='via'){
                    return false;
                }
                //包裹直接引用的优先级低于包裹嵌套的
                if(context.length === 2 && context[0]==='wrap'){
                    if( old.length > 2 && old[0]==='wrap'){
                        return false
                    }
                }
            }
            cache.set(decl, context);
            return true;
        }

        let declareParamsLen = declareParams.length;
        for(let index=0;index<declareParamsLen;index++){
            let declared = declareParams[index];
            let argument = assignments[index];
            if(!argument)return;
            if(parserFlag){
                if(argument.isFunctionExpression || argument.isObjectExpression || argument.isArrayExpression){
                    argument.parser();
                    argument.setRefBeUsed();
                }
            }
            if( argument.isSpreadElement ){
                const type = argument.type();
                let elements = [];
                let defaultValue = null;
                if( (type.isTupleType && !type.prefix) || type.isLiteralArrayType){
                    elements = type.elements;
                }else if(type.isTupleType && type.prefix){
                    defaultValue = type.elements[0];
                }
                for(let s=0;s<elements.length && (s+index)<declareParamsLen;s++){
                    declared = declareParams[s+index];
                    let value = elements[s] || defaultValue;
                    if(declared && value){
                        this.extract(declared, value, declareGenerics, onSetValue);
                    }else{
                        break;
                    }
                } 
            }
            if(declared.isRestElement){
                let _items = assignments.slice(index);
                if(parserFlag){
                    _items.forEach(argument=>{
                        if(argument.isFunctionExpression || argument.isObjectExpression || argument.isArrayExpression){
                            argument.parser();
                            argument.setRefBeUsed();
                        }
                    })
                }
                return this.extract(declared, MergeType.arrayToTuple(_items), declareGenerics, onSetValue);
            }
            this.extract(declared, argument, declareGenerics, onSetValue);
        }
    }

    extract(declared, argument, declareGenerics, onSetValue){
        if(!declared || !argument)return null;
        const isInScope=(declType)=>{
            if(!declareGenerics || !Array.isArray(declareGenerics))return true;
            if( declType && declType.target && declType.target.isGenericTypeDeclaration ){
                if(declType.target.parentStack.parentStack.isDeclaratorTypeAlias){
                    return true;
                }
            }
            return declareGenerics.some( item=>item.type() ===declType );
        }

        if( declared.isObjectPattern ){
            const argumentType = argument.type();
            if( !this.isObjectType(argumentType) ){
                return;
            }
            return declared.properties.forEach( property=>{
                const declType = property.type();
                if(!declType.hasGenericType)return;
                const matchResult = this.stack.getObjectDescriptor(argumentType, property.key.value(), false, true);
                if( declType.isGenericType ){
                    this.extractive(declType, matchResult, isInScope, onSetValue);
                }else{
                    this.extract(declType, matchResult, declareGenerics, onSetValue);
                }
            });
        }else if( declared.isArrayPattern ){
            const argumentType = argument.type();
            if( !(argumentType.isLiteralArrayType || argumentType.isTupleType) ){
                return;
            }
            return declared.elements.forEach( (item,index)=>{
                const declType = item.type();
                if(!declType.hasGenericType)return;
                const matchResult = this.stack.getObjectDescriptor(argumentType, index, false, true);
                if( declType.isGenericType ){
                    this.extractive(declType, matchResult, isInScope, onSetValue);
                }else{
                    this.extract(declType, matchResult, declareGenerics, onSetValue);
                }
            });
        }

        let declType = declared.type();
        if( declType ){
            if( declType.hasGenericType || declType.isFunctionType || declType.isClassGenericType){
                this.extractive(declType, argument, isInScope, onSetValue);
            }
            if(declType.isGenericType){
                if( declType.hasConstraint ){
                    let constraint = declType.inherit.type();
                    if( constraint && !constraint.check(argument, this) ){
                        const str1 = this.stack.isLiteralValueConstraint(constraint, this) ?  
                                    this.stack.getTypeLiteralValueString(declType, this) : 
                                    this.stack.getTypeDisplayName(declType, this);
                        const str2 =  this.stack.getTypeDisplayName(constraint, this);
                        argument.error(1003, str1, str2 );
                    }
                }
            }
        }
    }

    extractive(declareType, assignValue, checkScope, onSetValue){
        if(!declareType || !assignValue)return;
        let checkFlag = true;
        const context = [];
        const setValue = (decl, assignValue, callback)=>{
            if(!checkFlag || !checkScope || checkScope(decl, this, assignValue) ){
                if(onSetValue && onSetValue(decl, assignValue, context)===false){
                    return false;
                }
                if(callback){
                    return callback(decl, assignValue);
                }else{
                    if(assignValue.isLiteralArrayType){
                        assignValue = this.arrayToUnionType(decl, assignValue, true)
                    }
                    this.setValue(decl, assignValue);
                    return true;
                }
            }
            return false;
        }

        const forEach = (items, callback, flag)=>{
            for(let i=0;i<items.length;i++){
                if( callback(flag ? items[i] : items[i].type(), i) ){
                    return true;
                }
            }
            return false;
        }

        const every = (declareType,  assignType, callback)=>{
            if( declareType.isGenericType ){
                if(assignType && assignType.isClassGenericType && !assignType.isClassType){
                    this.make(assignType);
                }
                context.push('via')
                return setValue(declareType, assignType, callback);
            }else if(declareType.isTupleType && (assignType.isLiteralArrayType || assignType.isTupleType) ){
                const isRest = !!declareType.rest;
                context.push('array')
                return forEach(declareType.elements, (decl,index)=>{
                    if( decl.isGenericType ){
                        let assignValue = assignType;
                        if(!isRest){
                            if(!declareType.prefix){
                                if(assignType.isTupleType){
                                    if(assignType.elements.length===1){
                                        assignValue = assignType.elements[0]
                                    }else{
                                        assignValue = assignType.elements[index] || Namespace.globals.get('any');
                                    }
                                }else if(assignType.isLiteralArrayType){
                                    assignValue = assignType.elements[index] || Namespace.globals.get('any');
                                }
                            }else{
                                if(assignType.isTupleType && assignType.prefix && assignType.elements.length===1){
                                    assignValue = assignType.elements[0]
                                } 
                            }
                        }else if(assignValue.isTupleType){
                            assignValue = this.arrayToUnionType(decl, assignValue)
                        }
                        return setValue(decl, assignValue, (decl, assignType)=>{
                            return this.setValue(decl, this.arrayToUnionType(decl, assignType, isRest))
                        });
                    }else{
                        let assign = null
                        if(decl.isTupleType){
                            if( assignType.isLiteralArrayType ){
                                const origin = Namespace.globals.get('Array');
                                const mergeType = new MergeType( origin );
                                mergeType.keepOriginRefs = true;
                                mergeType.hasTuplePrefix = !!decl.prefix;
                                mergeType.isTupleType = true
                                mergeType.isTupleUnion = !!decl.isTupleUnion;
                                mergeType.forceNotTupleUnion = !decl.prefix;
                                mergeType.target = assignType.target;
                                assignType.elements.forEach( item=>{
                                    mergeType.add( item );
                                });
                                assign = mergeType.type();

                            }else if(assignType.isTupleType){
                                assign = assignType;
                            }

                            if(assign.elements[index]){
                                if(decl.prefix && !assign.prefix){
                                    assign = MergeType.to(assign.elements[index], true)
                                }else if(assign.prefix === decl.prefix){
                                    assign = assign.elements[index];
                                    if( assign.isTupleType && !decl.prefix && decl.elements.length < assign.elements.length){
                                        assign = Namespace.globals.get('any');
                                    }
                                }
                            }else{
                                assign = Namespace.globals.get('any');
                            }

                        }else{
                            assign = assignType.elements[index];
                        }
                        if(assign){
                            return every(decl, assign, (decl, assignType)=>{
                                return this.setValue(decl, assignType)
                            });
                        }
                    }
                });
            }else if( declareType.isUnionType ){
                context.push('union')
                return forEach(declareType.elements, decl=>{
                    return every(decl, assignType, callback)
                });
            }else if(declareType.isLiteralObjectType) {
                context.push('object')
                return forEach( Array.from(declareType.properties.values()), property=>{
                    let decl = property.type();
                    if( decl.hasGenericType ){
                        const value = this.stack.getObjectDescriptor(assignType, property.key.value());
                        if(value){
                            return every(decl, value.type(), callback);
                        }
                    }
                }, true);
            }else if( declareType.isClassGenericType){
                context.push('wrap')
                const inherit = declareType.inherit.type();
                if( assignType.isClassGenericType ){
                    if( inherit.is( assignType.inherit.type() ) ){
                        const [,declareGenerics=[]] = this.getDeclareGenerics(declareType);
                        forEach(declareType.types, (value,index)=>{
                            let _decl = declareGenerics[index];
                            if(_decl){
                                _decl = _decl.type();
                                this.setValue(_decl, value);
                            }
                            if( assignType.types[index] ){
                                let _old = checkFlag;
                                checkFlag = false;
                                every(value, assignType.types[index].type())
                                checkFlag = _old;
                            }
                        });
                        return true;
                        // return forEach(declareType.types, (decl,index)=>{
                        //     if( assignType.types[index] ){
                        //         return every(decl, assignType.types[index].type(), callback);
                        //     }
                        // });
                    }

                // }else if(!declareType.isClassType && inherit.isAliasType){
                //     //const wrap = inherit;
                //     const [,declareGenerics=[]] = declareType.target.getDeclareGenerics();
                //     // let declareGenerics = [];
                //     // if( wrap.target && wrap.target.isDeclaratorTypeAlias && wrap.target.genericity ){
                //     //     declareGenerics = wrap.target.genericity.elements;
                //     // }

                //     return every(inherit.inherit.type(), assignType, (decl, assignValue)=>{
                //         const index = declareGenerics && declareGenerics.findIndex( item=>item.type() === decl );
                //         if( index>=0 ){
                //             assignValue = this.arrayToUnionType(decl, assignValue)
                //             setValue(decl, assignValue);
                //             let _decl = declareType.types[index];
                //             if( _decl && (_decl = _decl.type()) && _decl.isGenericType){
                //                 return setValue(_decl, assignValue);
                //             }else{
                //                 return true;
                //             }
                //         }
                //         return false;
                //     });
                // }else{
                //     const [,declareGenerics=[]] = declareType.target.getDeclareGenerics();
                //     return forEach(declareType.types, (decl,index)=>{
                //         let _decl = declareGenerics[index];
                //         if(_decl){
                //             setValue(_decl, decl);
                //         }
                //         return every(decl, assignType, callback);
                //     });
                // }


                }else if(!declareType.isClassType && inherit.isAliasType){
                    //const wrap = inherit;
                    const [,declareGenerics=[]] = this.getDeclareGenerics(declareType);
                    // let declareGenerics = [];
                    // if( wrap.target && wrap.target.isDeclaratorTypeAlias && wrap.target.genericity ){
                    //     declareGenerics = wrap.target.genericity.elements;
                    // }
                    forEach(declareType.types, (value,index)=>{
                        let _decl = declareGenerics[index];
                        if(_decl){
                            _decl = _decl.type();
                            this.setValue(_decl, value);
                        }
                    });
                    return every(inherit.inherit.type(), assignType, (decl, assignValue)=>{
                        let setFlag = false;
                        assignValue = this.arrayToUnionType(decl, assignValue);
                        forEach(declareType.types, (value,index)=>{
                            let _decl = declareGenerics[index];
                            if(_decl){
                                _decl = _decl.type();
                                this.setValue(_decl, value);
                                if(!setFlag){
                                    setFlag = every(value, assignValue, callback);
                                }
                            }
                        });
                        return true;
                    });
                }else{
                    const [,declareGenerics=[]] = this.getDeclareGenerics(declareType);
                    let setFlag = false;
                    forEach(declareType.types, (value,index)=>{
                        let _decl = declareGenerics[index];
                        if(_decl){
                            _decl = _decl.type();
                            this.setValue(_decl, value);
                        }
                        if(!setFlag){
                            setFlag = every(value, assignType, callback);
                        }
                    });
                    return true;
                }

            }else if( declareType.isIntersectionType ){
                context.push('intersect')
                return forEach([declareType.left.type(), declareType.right.type()], (decl)=>{
                    return every(decl, assignType, callback);
                })
            }else if(declareType.isAliasType){
                return every(declareType.inherit.type(), assignType, callback);
            }else if(declareType.isFunctionType && assignType.isFunctionType){
                context.push('function')
                const voidType = Namespace.globals.get('void');
                let assignValue = assignType.getInferReturnType();
                let decl = declareType.returnType;
                if( decl && assignValue){
                    decl = decl.type();
                    if(voidType !== decl ){
                        if(assignType.async){
                            const origin = Utils.getOriginType(assignValue);
                            const promiseType = Namespace.globals.get("Promise");
                            if(origin !== promiseType){
                                assignValue = new InstanceofType(promiseType, null, [assignValue] );
                                this.make(assignValue);
                            } 
                        }
                        return every(decl, assignValue, callback);
                    }
                }
            }
            return false;
        }

        every(declareType, assignValue.type());

    }

    arrayToUnionType(declareType, assignType, isRest=false){
        if( !declareType || !assignType || !declareType.isGenericType )return assignType;
        const inherit = declareType.inherit;
        const isKeyof = inherit && inherit.isKeyofType
        if( assignType.isLiteralArrayType || assignType.isTupleType ){
            return MergeType.to(assignType, !isRest, true, isKeyof );
        }
        return assignType;
    }

}

module.exports = Context;