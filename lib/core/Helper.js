const JSModule = require("./JSModule");
const MergeType = require("./MergeType");
const Namespace = require("./Namespace");
const Utils = require("./Utils");
const emptyOnlyreadArray = [];
const fallbackInfer = (type)=>type;

const NOT_ASSING_GENERICS = 1;
const MISSING_ASSING_GENERICS = 1 << 1;
const FAILED_ASSING_GENERICS = 1 << 2;
const DESCRIPTOR_TYPE_UNMATCH = 1 << 3;
const FUN_TYPE_PARAMS_UNMATCH = 1 << 4;

function toTyper(object){
    if(object.isGenericType && object.hasConstraint){
        object = object.inherit.type();
    }
    if(object.isTypeofType ){
        object = object.origin;
    }
    if(object.isComputeType ){
        object = object.getResult();
    }
    return object;
}

function isLiteralObject(object){
    if(object.isTypeofType && object.origin){
        return this.isLiteralObject(object.origin.type());
    }
    if( object.isLiteralArrayType || object.isTupleType || object.isLiteralObjectType || (object.isGenericType && object.hasConstraint) || object.isEnumType ){
        return true;
    }
    return false;
}

function getObjectComputeDescriptor(object, propertyType){
    if( isLiteralObject(object) || Utils.isTypeModule(object) ){
        if(object.isGenericType && object.hasConstraint){
            object = object.inherit.type();
        }
        if(propertyType){
            return object.dynamicAttribute(propertyType);
        }
    }
    return null;
}

function getObjectDescriptor(object, property, isStatic=false, prevObject=null, isInCall=false){
    if(!Utils.isType(object)){
        throw new Error("Type is invalid");
    }
    object = toTyper(object);
    if(object === prevObject){
        return Namespace.globals.get('any');
    }
    if(object.isAnyType)return Namespace.globals.get('any');
    if( object.isAliasType ){
        return getObjectDescriptor(object.inherit.type(), property, isStatic, object, isInCall);
    }
    if(object.isClassGenericType){
        if(object.isClassType){
            return getObjectDescriptor(object.types[0].type(), property, true, object, isInCall)
        }else{
            const wrap = object.inherit.type();
            if( wrap.target && wrap.target.isDeclaratorTypeAlias && wrap.target.genericity ){
                const declareGenerics = wrap.target.genericity.elements;
                if(object.elements.length===1 && declareGenerics.length === 1){
                    const has = declareGenerics[0].type() === wrap.inherit.type();
                    if(has){
                        return getObjectDescriptor(object.elements[0].type(), property, false, object, isInCall);
                    }
                }
                return getObjectDescriptor(wrap.inherit.type(), property, false, object, isInCall);
            }
        }
    }

    if( object.isIntersectionType ){
        return getObjectDescriptor(object.left.type(), property, isStatic, object, isInCall) || 
                getObjectDescriptor(object.right.type(), property, isStatic, object, isInCall);
    }

    let dynamicAttribute = false;
    let result = null;
    if( object.isUnionType ){
        const properties = [];
        const elems = object.elements;
        const isTypeDefinition = (stack)=>{
            return stack.isTypeObjectPropertyDefinition || 
                stack.isPropertyDefinition || 
                stack.isMethodGetterDefinition;
        };
        let matchResult = null;
        let isFullMatch = true;
        let anyType = null;
        let hasNull = false;
        for(let i=0;i<elems.length;i++){
            const item = elems[i];
            const objectType = item.type();
            const isNull = Utils.isNullType(objectType);
            if(!objectType || objectType.isAnyType || isNull){
                if(isNull){
                    hasNull = true;
                }
                if(objectType.isAnyType){
                    anyType = objectType;
                }
                continue;
            }
            const result = getObjectDescriptor(objectType, property, isStatic, object,isInCall);
            if( result ){
                if(isInCall){
                    if(!matchResult){
                        if( (result.isMethodDefinition && !result.isAccessor) || result.isFunctionExpression || result.isFunctionType){
                            matchResult = result
                        }else if((result.isPropertyDefinition || result.isMethodGetterDefinition || result.isTypeObjectPropertyDefinition || result.isProperty) && Utils.isStack(result)){
                            const type = result.type();
                            if(type.isFunctionType){
                                matchResult = result;
                            }
                        }
                    }
                }else if(!matchResult){
                    if( isTypeDefinition(result) ){
                        matchResult = result;
                        properties.length = 0;
                    }else{
                        properties.push(result);
                    }
                }
            }else{
                isFullMatch = false;
            }
        }
        if(properties.length > 0){
            if( properties.length===1 ){
                matchResult = properties[0];
            }else{
                const mergeType = new MergeType();
                properties.forEach( item=>{
                    mergeType.add( item )
                });
                matchResult = mergeType.type();
            }
        }
        return matchResult || anyType;
    }else if(isLiteralObject(object)){
        dynamicAttribute = true;
        let desc = object.target && (object.target.isObjectExpression || object.target.isTypeObjectDefinition) ? object.target.attribute(property) : object.attribute(property);
        if(desc){
            return desc;
        }
    }

    const origin = Utils.getOriginType(object);
    result = getMatchDescriptor(property, origin, isStatic);
    if(!result){
        let literalType = typeof property === 'number' ? 'number' : 'string';
        if(object.isLiteralArrayType || object.isTupleType){
            if(literalType==='string'){
                literalType = null;
                if(!isNaN(parseInt(property))){
                    literalType = 'number';
                }
            }else{
                literalType = 'number'
            }
        }
        if(literalType){
            result = getObjectComputeDescriptor( dynamicAttribute ? object : origin, Namespace.globals.get(literalType));
        }
    }
    return result;
}

function checkTypeConstraint(argumentStack, declareParam, acceptType){
    if(!acceptType)return true;
    const argumentType = argumentStack.type();
    if(!argumentType){
        return false;
    }
    if( argumentType.isGenericType ){
        return true;
    }
    if(argumentStack.isSpreadElement && (argumentType.isTupleType || argumentType.isLiteralArrayType)){
        return argumentType.elements.some( el=>acceptType.is(el.type()) )
    }
    if( declareParam && declareParam.isObjectPattern ){
        if( argumentType.isLiteralObjectType || argumentType.isInstanceofType || argumentType.isEnumType || (argumentType.isEnum && argumentType.isModule) ){
            return true;
        }else{
            const objectType = Namespace.globals.get('object');
            return objectType.is(argumentType);
        }
    }else if(declareParam && declareParam.isArrayPattern){
        const arrayType = Namespace.globals.get('array');
        return arrayType.is(argumentType);
    }else if(acceptType){
        if(acceptType.isGenericType){
            if(acceptType.hasConstraint){
                const constraint = acceptType.inherit.type();
                if(constraint !== acceptType){
                    return checkTypeConstraint(argumentStack, declareParam, constraint);
                }
            }
            return true;
        }else if( acceptType.isFunctionType ){
            if(!argumentType.isFunctionType)return false;
            let last = acceptType.params[acceptType.params.length-1];
            let hasRest = last && last.isRestElement ? true : false;
            if(argumentType.params.length>acceptType.params.length && !hasRest)return false;
            return acceptType.params.every((decl,index)=>{
                const assign = argumentType.params[index];
                if(assign)return true;
                return !!(decl.isAssignmentPattern || decl.question || decl.isRestElement)
            });
        }else if( acceptType.isLiteralObjectType ){
            return acceptType.constraint(argumentType);
        }else if( acceptType.isLiteralArrayType ){
            const arrayType = Namespace.globals.get('array');
            return arrayType.is(argumentType);
        }
        if( !acceptType.is(argumentType) ){
            return false
        }
    }
    return true;
}

function getMatchDescriptor(property, classModule, options={}){
    
    if(!property || !classModule || !(classModule.isModule || classModule.isNamespace || JSModule.is(classModule) ||
        classModule.isUnionType && property==='#match-union-type' || 
        classModule.isLiteralObjectType && (property==='#new#' || property==='#call#')
    ))return null;

    if(classModule.isClassGenericType && classModule.isClassType){
        options.isStatic = true;
        return getMatchDescriptor(property, type.types[0], options);
    }

    let {
        isStatic=false,
        isCall=false,
        isNew=false,
        isSet=false,
        onlyAccessProperty=false,
        args=emptyOnlyreadArray,
        assigments=emptyOnlyreadArray,
        infer=fallbackInfer
    } = options;
   
    if( onlyAccessProperty ){
        isCall = false;
        isNew = false;
        isSet = false;
    }

    let incompleteFlag = 0;
    let matchResult = false;
    const checkMatchFun = (params, declareGenerics, desc)=>{
        incompleteFlag = 0;
        matchResult = false;
        if( params.length === args.length && args.length === 0 ){
            return matchResult = true;
        }else if( params.length >= args.length){
            if(assigments.length>0){
               if(declareGenerics.length < assigments.length )incompleteFlag=FAILED_ASSING_GENERICS;
               if(declareGenerics.length > assigments.length )incompleteFlag=MISSING_ASSING_GENERICS;
            }else if(declareGenerics.length>0){
                const required = declareGenerics.some( item=>{
                    if(item.isGenericTypeDeclaration && !item.extends){
                        return true;
                    }
                    return false;
                });
                if(required){
                    incompleteFlag = NOT_ASSING_GENERICS;
                }
            }
            if(!isNew && desc.isConstructor){
                incompleteFlag |=  DESCRIPTOR_TYPE_UNMATCH;
            }
            matchResult = params.every( (declare,index)=>{
                const argument = args[index];
                const optional = !!(declare.question || declare.isAssignmentPattern);
                if( argument ){
                    if(argument.isSpreadElement && declare.isRestElement){
                        return true;  
                    }else if(declare.isRestElement){
                        let acceptType = infer(declare.type());
                        if(acceptType.isTupleType){
                            return args.slice(index).every( arg=>{
                                return acceptType.elements.some( el=>checkTypeConstraint(arg, el, el.type()))
                            })
                        }else{
                            return false;
                        }
                    }

                    let acceptType = infer(declare.type());
                    if(checkTypeConstraint(argument, declare, acceptType)){
                        return true;
                    }else{
                        if(acceptType && acceptType.isFunctionType && argument.type().isFunctionType){
                            incompleteFlag |=  FUN_TYPE_PARAMS_UNMATCH;
                        }
                        return false;
                    }
                }
                return optional;
            });
            return matchResult && incompleteFlag === 0;
        }
        return false;
    };

    let target = null;
    const records = [];
    const update = (desc, params, generics)=>{
        records[0] = desc;
        records[1] = params;
        records[2] = generics;
        records[3] = matchResult;
        records[4] = incompleteFlag;
        return records;
    }
    const calcScore=(result, params, generics, incompleteFlag,desc)=>{
        let score = result ? 500 : 0;
        if( incompleteFlag === -1 ){
           return -1
        }
        if(assigments && assigments.length >0){
            score+= generics.length;
        }
        if((NOT_ASSING_GENERICS & incompleteFlag) === NOT_ASSING_GENERICS){
            score -= generics.length
            for(let i=0;i<generics.length;i++){
                const decl = generics[i].type();
                if(decl.assignType){
                    score += generics.length-i
                    break;
                }
            }
        }

        if((FUN_TYPE_PARAMS_UNMATCH & incompleteFlag) === FUN_TYPE_PARAMS_UNMATCH){
            score += 1;
        }

        if((MISSING_ASSING_GENERICS & incompleteFlag) === MISSING_ASSING_GENERICS){
            score -= generics.length - assigments.length;
        }
        if((FAILED_ASSING_GENERICS & incompleteFlag) === FAILED_ASSING_GENERICS){
            score -= 500;
            score -= assigments.length - generics.length
        }
        if((DESCRIPTOR_TYPE_UNMATCH & incompleteFlag) === DESCRIPTOR_TYPE_UNMATCH){
            score-= 1;
        }
        if( args.length > params.length ){
            score -= args.length - params.length;
        }else if( args.length < params.length){
            score -= params.length - args.length
        }
        return score;
    }
    const choose = (prev, desc, params, generics)=>{
        if(!prev){
            records.push(desc, params, generics, matchResult, incompleteFlag);
            return records;
        }
        let pScore = calcScore(prev[3], prev[1], prev[2], prev[4], prev[0])
        let cScore = calcScore(matchResult, params, generics, incompleteFlag, desc)
        let pResult = (FAILED_ASSING_GENERICS & prev[4]) !== FAILED_ASSING_GENERICS && prev[3];
        let cResult = (FAILED_ASSING_GENERICS & incompleteFlag) !== FAILED_ASSING_GENERICS && matchResult;
        if(pResult && cResult && pScore===cScore && desc.toString() === prev.toString()){
            if(desc.isDeclaratorFunction || desc.isDeclaratorVariable){
                const cAnnots = desc.annotations.length + desc.imports.length;
                const pAnnots = prev.annotations.length + prev.imports.length;
                if(cAnnots>pAnnots){
                    return update(desc, params, generics);
                }else if(cAnnots<pAnnots){
                    return prev;
                }
            }
        }
        if(cResult){
            if(pResult && pScore > cScore)return prev;
            return update(desc, params, generics);
        }
        if(!pResult && cScore >= pScore){
            return update(desc, params, generics);
        }else{
            return prev
        }
    }
    const filter = (desc, prev, index, descriptors, extendsContext)=>{
        const isStaticDesc = desc.callableStatic || Utils.isStaticDescriptor(desc);
        if(isStatic){
            if( !isStaticDesc && !desc.isReadonly ){
                if( !extendsContext || !extendsContext.callableStatic )return false;
            }
        }else if( isStaticDesc ){
            return false;
        }
        incompleteFlag = -1;
        if( isCall ){
            if( desc.isEnumProperty || desc.isMethodSetterDefinition || desc.isModuleDeclaration)return false;
            let params = emptyOnlyreadArray;
            let generics = emptyOnlyreadArray;
            if( desc.isMethodDefinition && !desc.isMethodGetterDefinition || desc.isDeclaratorFunction || desc.isTypeFunctionDefinition || isNew && desc.isNewDefinition || !isNew && desc.isCallDefinition){
                generics = desc.genericity ? desc.genericity.elements : emptyOnlyreadArray;
                params = desc.params || emptyOnlyreadArray;
                if(isNew){
                    if(!(desc.isConstructor || desc.isNewDefinition || desc.isTypeFunctionDefinition))return false; 
                    if(generics===emptyOnlyreadArray && !desc.isNewDefinition && !(desc.isDeclaratorFunction || desc.isTypeFunctionDefinition) && Module.is(desc.module)){
                        generics = desc.module.getModuleDeclareGenerics(false,true);
                    }
                }
                if( checkMatchFun(params, generics, desc) ){
                    return true;
                }
            }else if(desc.isPropertyDefinition || desc.isMethodGetterDefinition || desc.isDeclaratorVariable || desc.isDeclaratorDeclaration || desc.isInterfaceDeclaration){
                if(desc.isDeclaratorVariable && descriptors && descriptors.length===1){
                    return true;
                }
                let type = desc.type();
                if( type ){
                    if(isNew){
                        if(type.isClassGenericType && type.isClassType){
                            return true;
                        }
                        if(desc.isDeclaratorDeclaration && type.isClass){
                            return true;
                        }
                    }
                    if(type.isFunctionType){
                        generics = type.generics;
                        params = type.params || emptyOnlyreadArray;
                        if(checkMatchFun(params, generics, desc)){
                            return true
                        }
                    }else{
                        let _result = this.findImplementedCallableDescriptorByType(type, isNew)
                        if(_result){
                            return true;
                        }
                    }
                }
            }
            return choose(prev, desc, params, generics);
        }else if( isSet ){
            if( desc.isEnumProperty || desc.isModuleDeclaration)return false;
            if( desc.isMethodSetterDefinition ){
                return true;
            }else if( desc.isPropertyDefinition ){
                if( !desc.isReadonly ){
                    return true;
                }
            }
        }else{
            if( desc.isMethodGetterDefinition || 
                desc.isPropertyDefinition || 
                desc.isEnumProperty || 
                desc.isDeclaratorVariable || 
                desc.isDeclaratorFunction || 
                desc.isModuleDeclaration || 
                desc.isTypeFunctionDefinition){
                return true;
            }
        }
        return prev || desc;
    }

    if(classModule.isUnionType){
        if(!isCall || isNew)return null;
        let resules = [];
        let matchedResules = [];
        let prev = null;
        classModule.elements.forEach((item)=>{
            const type = item.type();
            if(type.isFunctionType){
                const generics = type.generics || emptyOnlyreadArray
                const params = type.params || emptyOnlyreadArray;
                if( checkMatchFun(params, generics, type) ){
                    matchedResules.push(type);
                }else{
                    const value = choose(prev, type, params, generics);
                    const res = value === records ?  value[0] : value;
                    prev = value;
                    if( !resules.includes(res) ){
                        resules.push(res);
                    }
                }
            } 
        });
        if( matchedResules.length>0 ){
            return matchedResules;
        }
        return resules;
    }

    const result = classModule.getDescriptor(property, filter, {isNew, isCall});
    return result === records ?  result[0] : target || result;
}


function checker(inferContext, constraint, type){
    
}


module.exports={
    getObjectDescriptor,
    getMatchDescriptor,
}
