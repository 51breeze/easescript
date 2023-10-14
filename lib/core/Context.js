const Namespace = require('./Namespace');
const UnknownType = require('../types/UnknownType');
const Utils = require('./Utils');
const MergeType = require('./MergeType');
const UKType = new UnknownType();
const privateKey = Symbol('privateKey');
class Context{

    constructor(stack){
        this.stack = stack;
        this.children = [];
        this.parent = null;
        this.dataset = new Map();
        this._declareGenerics = null;
        this.makeDoneCache = new WeakSet();
        this.applyResult = new Map();
        this.isContext = true;
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
        if( declare && declare.isGenericDeclaration ){
            this._declareGenerics = declare;
            declare.elements.forEach( item=>{
                const type = item.type();
                if(type.assignType){
                    this.setValue(type, type.assignType)
                }else if( type.hasConstraint ){
                    this.setValue(type, type.inherit)
                }else {
                    this.setValue(type, UKType);
                }
            });
        }
    }

    setValue(type, value){
        if( type && value){
            if( type.isGenericType ){
                if(value.isGenericType){
                   const res = this.getValue(value, true);
                   if( res )value = res;
                }
                this.dataset.set(type.getUniKey(), value);
            }else{
                throw new Error(`Assigment type is not generic-type`);
            }
        }
    }

    getValue(type, flag){
        if(!type || !type.isGenericType)return null;
        const result = this.dataset.get(type.getUniKey()) || null;
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

    assignment(type,callback){
        if(!type || type.isGenericType)return;
        if(type.isAliasType){
            if( type.target && type.target.isDeclaratorTypeAlias ){
                this.merge( type.target.getContext() )
            }
            const inherit = type.inherit;
            if( inherit ){
                this.assignment(inherit.type(),callback);
            }
            return;
        }

        const setValue=(assignments)=>{
            if( declareGenerics ){
                declareGenerics.forEach( (declare, index)=>{
                    const value = assignments[index];
                    if( value ){
                        if(callback){
                            callback(declare.type(), value);
                        }else{
                            this.setValue(declare.type(), value)
                        }
                    }
                });
            }
        };

        let originType = type.isClassGenericType ? type.inherit.type() : Utils.getOriginType(type);
        let declareGenerics = null;
        if( originType && originType.isModule ){
            declareGenerics = originType.getModuleGenerics();
            this.merge( originType.moduleStack.getContext() );
        }
       
        if(type.isTupleType || type.isLiteralArrayType){
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
                this.assignment(assign,callback);
            });
            setValue(type.types);

            if( declareGenerics && declareGenerics.length > 0){
                this.dataset.forEach( (value, key)=>{
                    const decl = value.type();
                    const index = declareGenerics.indexOf( decl );
                    if( index >= 0 ){
                        const value = type.types[index];
                        this.dataset.set(key, value);
                    }
                })
            }
        }
    }

    make(type){
        if(!type || type.isGenericType)return false;
        if(this.makeDoneCache.has(type))return true;
        this.makeDoneCache.add(type);
        if( type.isIntersectionType ){
            this.make(type.left.type());
            this.make(type.right.type());
        }else if( type.isUnionType ){
            const dataset = new Map();
            type.elements.forEach( item=>{
                this.assignment(item.type(),(key, value)=>{
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

    fetch(type, flag=false, prev=null){
        if(!type)return null;
        if(!type.isGenericType)return type;
        let result = this.getValue(type);
        let value = result ? result.type() : null;
        if(value && value.isGenericType && value !== type){
            return this.fetch(value, flag, prev);
        }else if((!result||value === UKType) && this.parent){
            if(value)prev = value;
            return this.parent.fetch(type, flag, prev||value);
        }
        if( !value ){
            value = type.assignType;
        }
        if(!value && prev){
            value = prev
        }
        return flag && !value ? type : value;
    }

    get inference(){
        return (type)=>{
            if(!type || !type.isGenericType)return type;
            let result = this.fetch(type);
            if( result ){
                return result.type();
            }
            return type;
        }
    }
    
    apply(type){
        if(type && type.hasGenericType){
            if(type.isGenericType){
                return this.fetch(type) || UKType;
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

    extracts(declareParams, assignments, declareGenerics){
        if(declareGenerics && Array.isArray(declareGenerics)){
            declareGenerics.forEach( declare=>{
                const declared = declare.type();
                const assignType = declared.assignType;
                if( assignType ){
                    this.setValue(declared, assignType);
                }
            });
        }
        assignments.forEach((argument,index)=>{
            let declared = declareParams[index];
            if( argument.isSpreadElement ){
                const type = argument.type();
                let elements = [];
                let defaultValue = null;
                if( (type.isTupleType && !type.prefix) || type.isLiteralArrayType){
                    elements = type.elements;
                }else if(type.isTupleType && type.prefix){
                    defaultValue = type.elements[0];
                }
                for(let s=0;s<elements.length;s++){
                    declared = declareParams[s+index];
                    let value = elements[s] || defaultValue;
                    if(declared && value){
                        this.extract(declared, value, declareGenerics);
                    }else{
                        break;
                    }
                }
                return;
            }
            if( declared ){
                this.extract(declared, argument, declareGenerics);
            }
        });
    }

    extract(declared, argument, declareGenerics){
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
                    this.extractive(declType, matchResult, isInScope);
                }else{
                    this.extract(declType, matchResult, declareGenerics);
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
                    this.extractive(declType, matchResult, isInScope);
                }else{
                    this.extract(declType, matchResult, declareGenerics);
                }
            });
        }

        let declType = declared.type();
        if( declType ){
            if( declType.hasGenericType || declType.isFunctionType){
                this.extractive(declType, argument, isInScope);
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

    extractive(declareType, assignValue, checkScope){
        if(!declareType || !assignValue)return;

        const setValue = (decl, assignValue, callback)=>{
            if( !checkScope || checkScope(decl, this, assignValue) ){
                if(callback){
                    return callback(decl, assignValue);
                }else{
                    if(declareType === decl){
                        if(assignValue.isLiteralArrayType){
                            assignValue = this.arrayToUnionType(decl, assignValue, true)
                        }
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
                return setValue(declareType, assignType, callback);
            }else if(declareType.isTupleType && (assignType.isLiteralArrayType || assignType.isTupleType) ){
                const isRest = !!declareType.rest;
                return forEach(declareType.elements, (decl,index)=>{
                    if( decl.isGenericType ){
                        return setValue(decl, assignType, (decl, assignType)=>{
                            return this.setValue(decl, this.arrayToUnionType(decl, assignType, isRest))
                        });
                    }else{
                        let assign = null
                        if(decl.isTupleType && assignType.isLiteralArrayType){
                            const origin = Namespace.globals.get('Array');
                            const mergeType = new MergeType( origin );
                            mergeType.keepOriginRefs = true;
                            mergeType.hasTuplePrefix = !!decl.prefix;
                            mergeType.isTupleType = true
                            mergeType.isTupleUnion = !!decl.prefix
                            mergeType.target = assignType.target;
                            assignType.elements.forEach( item=>{
                                const type = item.type();
                                if(type.isLiteralArrayType || type.isTupleType){
                                    mergeType.add( item );
                                }
                            });
                            if(mergeType.types.size > 0){
                                assign = mergeType.type();
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
                return forEach(declareType.elements, decl=>{
                    return every(decl, assignType, callback)
                });
            }else if(declareType.isLiteralObjectType) {
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

                const inherit = declareType.inherit.type();
                if( assignType.isClassGenericType ){
                    if( inherit.is( assignType.inherit.type() ) ){
                        return forEach(declareType.types, (decl,index)=>{
                            if( assignType.types[index] ){
                                return every(decl, assignType.types[index].type(), callback);
                            }
                        });
                    }
                }else if(!declareType.isClassType && inherit.isAliasType){
                    const wrap = inherit;
                    let declareGenerics = [];
                    if( wrap.target && wrap.target.isDeclaratorTypeAlias && wrap.target.genericity ){
                        declareGenerics = wrap.target.genericity.elements;
                    }
                    return every(inherit.inherit.type(), assignType, (decl, assignValue)=>{
                        const index = declareGenerics && declareGenerics.findIndex( item=>item.type() === decl );
                        if( index>=0 ){
                            assignValue = this.arrayToUnionType(decl, assignValue)
                            this.setValue(decl, assignValue);
                            let _decl = declareType.types[index];
                            if( _decl && (_decl = _decl.type()) && _decl.isGenericType){
                                return setValue(_decl, assignValue);
                            }else{
                                return true;
                            }
                        }
                        return false;
                    });
                }else{
                    return forEach(declareType.types, (decl)=>{
                        return every(decl, assignType, callback);
                    });
                }

            }else if( declareType.isIntersectionType ){
                return forEach([declareType.left.type(), declareType.right.type()], (decl)=>{
                    return every(decl, assignType, callback);
                })
            }else if(declareType.isAliasType){
                return every(declareType.inherit.type(), assignType, callback);
            }else if(declareType.isFunctionType && assignType.isFunctionType){
                const voidType = Namespace.globals.get('void');
                let assignValue = assignType.getInferReturnType();
                let decl = declareType.returnType;
                if( decl && assignValue){
                    decl = decl.type();
                    if(voidType !== decl ){
                        assignValue = this.apply(assignValue.type());
                        return every(decl, assignValue, callback)
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