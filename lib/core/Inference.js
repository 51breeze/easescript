const Namespace = require("./Namespace")
const MergeType = require('./MergeType');
const Utils = require("./Utils");
const LiteralType = require("../types/LiteralType");
function getComputeValue(object, property){
    const getProperty=(object, propName, propertyType)=>{
        let result = null;
        if( object.isInstanceofType ){
            if( propName ){
                result = object.inherit.getDescriptor(propName, (desc, prev)=>{
                    if( (desc.isPropertyDefinition || desc.isMethodGetterDefinition) && Utils.isModifierPublic(desc) ){
                        return true;
                    }
                    return prev || desc;
                });
            }
            if( !result ){
                result = object.inherit.dynamicAttribute( propertyType );
            }
            if( result && result.isStack && !Utils.isModifierPublic(result) ){
                return null
            }
        }else if( object.isLiteralObjectType ){
            result = (propName && object.attribute( propName )) || object.dynamicAttribute( propertyType );
        }else if( object.isLiteralArrayType || object.isTupleType ){
            const propIndex = propName === null ? -1 : parseInt( propName );
            if( propIndex >= 0 && propIndex < object.elements.length  ){
                result = object.elements[ propName ];
            }
            if(!result){
                result = object.dynamicAttribute( propertyType );
            }
        }else{
            object = Utils.getOriginType( object );
            if( object.isInterface && object.isModule ){
                if( propName ){
                    result = object.getDescriptor(propName, (desc, prev)=>{
                        if( (desc.isPropertyDefinition || desc.isMethodGetterDefinition) && Utils.isModifierPublic(desc) ){
                            return true;
                        }
                        return prev || desc;
                    });
                }
                if( !result ){
                    result = object.dynamicAttribute( propertyType );
                }
            }
        }
        return result ? result.type() : null;
    }
    const getProperties = (object,property)=>{
        if( property.isUnionType || property.isTupleType || property.isLiteralArrayType){
            const reduce = (accumulator,item) => (item.isUnionType || item.isTupleType ? item.elements.reduce(reduce, accumulator) : accumulator.concat(item.type()) );
            const keys = property.elements.reduce( reduce, []).filter( item=>item.isLiteralType );
            const values = keys.map( item=>{
                return getProperty(object, item.value, item);
            }).filter( item=>!!item );
            if( values.length ){
                if( values.length === 1 )return values[0];
                return MergeType.arrayToUnion(values, this.target, true);
            }
        }else{
            return getProperty(object, property.isLiteralType ? property.value : null, property);
        }
        return null;
    };
    const defaultType = Namespace.globals.get('any');
    const getDesc = (name,type)=>{
        if( object.isLiteralArrayType || object.isLiteralObjectType || (object.isGenericType && object.hasConstraint) || object.isTupleType ||
            object.isEnumType || object.isIntersectionType || object.isInstanceofType ){
            const desc = name ? object.attribute(name) : null;
            if(desc){
                return desc.type();
            }
            else if( object.isLiteralObjectType || object.isLiteralArrayType || object.isTupleType ){
                return getProperties(object,type) || defaultType;
            }
            else if( object.isInstanceofType ){
                return getProperties(object,type) || defaultType;
            }
        }else if(name){
            return getProperty(object, name, type) || defaultType;
        }else{
            return getProperties(object, type) ||  defaultType;
        }
    }
    return property.isLiteralType ? getDesc(property.value, property) : getDesc(null, property);
}

function extractWrapGenericValue(type){
    let records = null;
    let fetchOriginAssignValue = (origin, declareGeneric)=>{
        if(!Utils.isModule(origin))return null;
        let ret = origin.getAssignGenerics(declareGeneric)
        if(ret && ret.isGenericType){
            ret = origin.getAssignGenerics(ret) || ret;
        }
        return ret;
    }
    getClassGenericsFromType(type).forEach(type=>{
        let origin = Utils.getOriginType(type);
        let declareGenerics =getTypeDeclareGenerics(type);
        declareGenerics.forEach((decl,index)=>{
            let assign = type.types[index] || fetchOriginAssignValue(origin, decl) || decl.assignType;
            if(!assign && decl.hasConstraint){
                assign = decl.inherit;
            }
            if(assign){
                records = records || (records=new Map())
                records.set(decl, assign)
            }
        })
    });
    return records;
}

function extractGenericsFromType(type){
    if(!type)return [];
    if(type.isGenericType)return [type];
    if(type.isAliasType){
        return extractGenericsFromType(type.inherit.type());
    }
    let elements = null;
    if(type.isLiteralObjectType){
        elements = Array.from(type.properties.values());
    }else if(type.isLiteralArrayType || type.isTupleType || type.isUnionType){
        elements = type.elements;
    }else if(type.isClassGenericType){
        let inherit = type.inherit.type();
        if(Array.isArray(type.types)){
            elements = [...type.types];
        }else{
            elements = [];
        }
        elements.push(...getTypeDeclareGenerics(inherit));
    }else if(type.isIntersectionType){
        elements = [type.left, type.right];
    }else if(type.isInstanceofType && Array.isArray(type.generics)){
        elements = type.generics;
    }else if(type.isComputeType){
        elements = [type.object, type.property];
    }else if(type.isKeyofType){
        elements = [type.referenceType];
    }else if(type.isTypeofType){
        elements = [type.origin];
    }else if(type.isPredicateType){
        elements = [type.value];
    }
    if(elements){
        return elements.map(item=>{
            let _type = item.type();
            if(_type.hasGenericType){
                return extractGenericsFromType(_type);
            }
            return [];
        }).flat();
    }
    return [];
}

function getTypeDeclareGenerics(type, origin=null){
    if(type.isAliasType && type.target && type.target.isDeclaratorTypeAlias && type.target.genericity){
        return type.target.genericity.elements.map(item=>item.type());
    }else if(type.isClassGenericType && type.target && type.target.isTypeGenericDefinition){
        return type.target.getDeclareGenerics()[1].map(item=>item.type());
    }else if(type.isInstanceofType){
        type = type.inherit.type();
        if(type.isAliasType){
            return getTypeDeclareGenerics(type, origin);
        }
    }
    origin = origin || Utils.getOriginType(type);
    if(origin && Utils.isModule(origin)){
        return origin.getModuleDeclareGenerics()
    }
    return [];
}

function needToLiteralValue(type){
    if(!type)return false;
    if(type.isGenericType && type.hasConstraint){
        type = type.inherit.type();
    }   
    return type ? type.isKeyofType : false;
}

function getObjectProperty(object, key){
    if(object.isEnumType){
        return object.attribute(key);
    }else if(object.isLiteralObjectType){
        return object.properties.get(key);
    }else if(object.isIntersectionType){
        return getProperty(object.left, key) || getProperty(object.right, key);
    }else if(object.isInstanceofType || Utils.isInterface(object)){
        let origin = object.isInstanceofType ? Utils.getOriginType(object) : object;
        let descriptors = origin.descriptors.get(key);
        if(descriptors){
            let properties = descriptors.filter(item=>item.isPropertyDefinition || item.isMethodGetterDefinition).map(item=>item.type());
            return properties.length>1 ? MergeType.arrayToUnion(properties) : properties[0];
        }
    }
    return null;
}

function getAssigmentBoundType(generic, declared, assigment){
    let assigmentType = assigment.type();
    if(assigmentType.isTypeofType){
        assigmentType = assigmentType.origin.type();
    }

    // if(!declared.isUnionType && assigmentType.isUnionType){
    //     const els = assigmentType.elements;
    //     for(let i=0;i<els.length;i++){
    //         const res = getAssigmentBoundType(generic, declared, els[i].type());
    //         if(res){
    //             return res;
    //         }
    //     }
    //     return null;
    // }

    if(declared.isGenericType){
        if(generic.getUniKey() === declared.getUniKey()){
            if(assigmentType.isLiteralArrayType){
                return MergeType.to(assigmentType, false, false, needToLiteralValue(generic))
            }
            if(assigmentType.isLiteralType && needToLiteralValue(generic)){
                return new LiteralType(assigmentType.inherit, assigmentType.target, assigmentType.value, true)
            }
            return assigmentType;
        }
    }
    if(Utils.isInterface(declared)){
        let keys = declared.descriptors.keys();
        let isInterface = Utils.isInterface(assigmentType);
        if(isInterface && !declared.is(assigmentType)){
            return null;
        }
        for(let key of keys){
            let properties = declared.descriptors.get(key);
            for(let i=0;i<properties.length;i++){
                let property = properties[i];
                if(property.isPropertyDefinition || property.isMethodGetterDefinition){
                    let _declared = property.type();
                    if((assigmentType.isLiteralObjectType || isInterface) && _declared.hasGenericType){
                        let assigmentPropertry = getObjectProperty(assigmentType,key);
                        if(assigmentPropertry){
                            let res = getAssigmentBoundType(generic, _declared, assigmentPropertry);
                            if(res){
                                return res;
                            }
                        }
                    }
                }
            }
        }
    }else if(declared.isLiteralObjectType){
        let isObject = assigmentType.isLiteralObjectType || assigmentType.isEnumType || assigmentType.isInstanceofType || assigmentType.isIntersectionType;
        let isInterface = isObject ? false : Utils.isInterface(assigmentType)
        if(isObject || isInterface){
            let keys = declared.properties.keys();
            for(let key of keys){
                let property = declared.properties.get(key);
                let assigmentProperty = getObjectProperty(assigmentType, key);
                if(assigmentProperty){
                    let propertyType = property.type();
                    if(propertyType.hasGenericType){
                        let res = getAssigmentBoundType(generic, propertyType, assigmentProperty);
                        if(res){
                            return res;
                        }
                    }
                }
            }
        }
    }else if(declared.isTupleType){
        let elements = declared.elements;
        if(declared.prefix && assigmentType.isTupleType && assigmentType.prefix){
            return getAssigmentBoundType(generic, elements[0].type(), assigmentType.elements[0].type());
        }else if(declared.prefix && (assigmentType.isLiteralArrayType || (assigmentType.isTupleType && !assigmentType.prefix))){
            let results = assigmentType.elements;
            if(results.length>0){
                let constraint = elements[0].type();
                if(constraint.isGenericType){
                    if(generic.getUniKey() === constraint.getUniKey()){
                        return results.length>1 ? MergeType.arrayToUnion(results, null, needToLiteralValue(generic)) : results[0].type();
                    }
                }
                declared = elements[0].type();
                for(let i=0;i<results.length;i++){
                    let res = getAssigmentBoundType(generic, declared, results[i]);
                    if(res){
                        return res;
                    }
                }
            }else{
                return getAssigmentBoundType(generic, declared, Namespace.globals.get('any'));
            }
        }else if(assigmentType.isLiteralArrayType || assigmentType.isTupleType){
            let results =  assigmentType.elements;
            if(results.length===0){
                return getAssigmentBoundType(generic, declared, Namespace.globals.get('any'));
            }
            for(let i=0;i<elements.length;i++){
                let el = elements[i];
                let assign = results[i];
                if(!assign && assigmentType.isTupleType && assigmentType.prefix){
                    assign = results[0];
                }
                if(assign){
                    declared = el.type();
                    if(declared.hasGenericType){
                        let res = getAssigmentBoundType(generic, declared, assign);
                        if(res){
                            return res;
                        }
                    }
                }else{
                    break;
                }
            }
        }else if(declared.prefix){
            return getAssigmentBoundType(generic, elements[0].type(), assigmentType);
        }else{
            for(let i=0;i<elements.length;i++){
                let el = elements[i];
                let res = getAssigmentBoundType(generic, el.type(), assigmentType);
                if(res){
                    return res;
                }
            }
        }
    }else if(declared.isUnionType){
        let elements = declared.elements;
        let last = null
        for(let i=0;i<elements.length;i++){
            let el = elements[i];
            let res = getAssigmentBoundType(generic, el.type(), assigmentType);
            if(res){
                last = res;
                if(assigmentType.isFunctionType && !el.type().isFunctionType){
                    continue
                }
                return res;
            }
        }
        if(last){
            return last;
        }
    }else if(declared.isFunctionType){
        if(assigmentType.isFunctionType){
            const index = declared.params.findIndex(param=>param.isGenericType && generic.getUniKey() === param.getUniKey());
            if(index>=0){
                const _assigment = assigmentType.params[index];
                if(_assigment){
                    return _assigment.type();
                }
            }else{
                const rType = declared.getReturnedType();
                if(rType && rType.isGenericType && generic.getUniKey() === rType.getUniKey()){
                    return assigmentType.getInferReturnType();
                }
            }
        }
    }else if(declared.isIntersectionType){
        return getAssigmentBoundType(generic, declared.left.type(), assigmentType) || getAssigmentBoundType(generic, declared.right.type(), assigmentType);
    }else if(declared.isClassGenericType){
        if(assigmentType.isClassGenericType){
            if(declared.inherit.type()===assigmentType.inherit.type()){
                let declareGenerics = getTypeDeclareGenerics(declared.inherit.type());
                let index = declareGenerics.findIndex(decl=>decl.getUniKey()===generic.getUniKey())
                if(index>=0 && assigmentType.types[index]){
                    return assigmentType.types[index].type();
                }
            }else if(assigmentType.types.length>0){
                if(assigmentType.types.length>1){
                    return MergeType.arrayToTuple(assigmentType.types, false, false);
                }
                return assigmentType.types[0].type();
            }
        }else if((assigmentType.isTupleType || assigmentType.isLiteralArrayType) && declared.inherit.type().is(assigmentType.inherit.type())){
            let declareGenerics = getTypeDeclareGenerics(declared.inherit.type());
            let index = declareGenerics.findIndex(decl=>decl.getUniKey()===generic.getUniKey())
            if(index>=0){
                if(assigmentType.prefix && assigmentType.elements.length>0){
                    if(assigmentType.elements.length>1){
                        const newType = MergeType.mergeTupleElement(assigmentType);
                        return newType.elements[0].type();
                    }
                    return assigmentType.elements[0].type();
                }else{
                    return MergeType.arrayToUnion(assigmentType.elements);
                }
            }
        }
        else{
            const inherit = declared.inherit.type();
            if(inherit.isAliasType){
                return getAssigmentBoundType(generic, inherit, assigmentType);
            }
            else{
                let types = declared.types;
                for(let i=0;i<types.length;i++){
                    let el = types[i].type();
                    if(el.hasGenericType){
                        let res = getAssigmentBoundType(generic, el, assigmentType);
                        if(res){
                            return res;
                        }
                    }
                }
                return getAssigmentBoundType(generic, inherit, assigmentType);
            }
        }
    }else if(declared.isAliasType){
        return getAssigmentBoundType(generic, declared.inherit.type(), assigmentType);
    }else if(declared.isKeyofType){
        return getAssigmentBoundType(generic, declared.referenceType.type(), assigmentType);
    }else if(declared.isPredicateType){
        return getAssigmentBoundType(generic, declared.value.type(), assigmentType);
    }
    return null;
}

function findGenericIndex(genericItems, generic){
    return genericItems.findIndex(decl=>generic.getUniKey() === decl.type().getUniKey());
}

function extractModuleFromType(type, result=[]){
    if(!type)return result;
    if(type.isUnionType){
        type.elements.forEach(item=>{
            extractModuleFromType(item.type(), result);
        });
    }else if(type.isIntersectionType){
        extractModuleFromType(type.left.type(), result);
        extractModuleFromType(type.right.type(), result);
    }else if(Utils.isModule(type)){
        result.push(type);
    }
    return result;
}

function extractContextGenerics(records, context, origin=null, relateGenerics=[], excludeTuple=false){
    if(!context)return records;
    if(context.isTypeofType){
        return extractContextGenerics(records, context.origin.type(), null, relateGenerics)
    }

    if(origin){
        let _origins = extractModuleFromType(origin)
        if(_origins.length>1){
            _origins.forEach(origin=>{
                extractContextGenerics(records, context, origin, relateGenerics, excludeTuple);
            }); 
            return;
        }else{
            origin = _origins[0];
        }
    }

    let classDeclareGenerics = getTypeDeclareGenerics(context, origin);
    if(context.isAliasType){
        extractContextGenerics(records, context.inherit.type(), null, relateGenerics)
        if(classDeclareGenerics.length>0){
            classDeclareGenerics.forEach(decl=>{
                let assign = decl.assignType;
                if(assign){
                    push(decl, assign.type(), records);
                    let index = findGenericIndex(relateGenerics, decl);
                    if(index>=0){
                        push(relateGenerics[index], assign, records);
                    }
                }
            });
        }
    }else if(context.isTupleType || context.isLiteralArrayType){
        if(!excludeTuple){
            let assigmentType = context.elements.length>0 ? 
                context.isTupleType && context.prefix ? 
                    context.elements[0].type() : 
                        MergeType.arrayToUnion(context.elements) : 
                            Namespace.globals.get('any');
            classDeclareGenerics.forEach(decl=>{
                let index = findGenericIndex(relateGenerics, decl);
                push(decl, assigmentType, records);
                if(index>=0){
                    push(relateGenerics[index], assigmentType, records);
                }
                extractContextGenerics(records, assigmentType, null, [], true);
            });
        }else{
            context.elements.forEach(item=>extractContextGenerics(records, item.type(), null, [], true))
        }
    }else if(context.isInstanceofType){
        if(context.generics && context.generics.length>0){
            classDeclareGenerics.forEach((decl,pos)=>{
                let index = findGenericIndex(relateGenerics, decl);
                let assign = context.generics[pos];
                push(decl, assign, records, true)
                if(index>=0){
                    push(relateGenerics[index], assign, records, true);
                }
                if(assign){
                    extractContextGenerics(records, assign.type(), null, [], true);
                }
            });
        }
    }else if(context.isClassGenericType){
        if(context.types && context.types.length>0){
            classDeclareGenerics.forEach((decl,pos)=>{
                let index = findGenericIndex(relateGenerics, decl);
                let assign = context.types[pos];
                push(decl, assign, records, true)
                if(index>=0){
                    push(relateGenerics[index], assign, records, true);
                }
                if(assign){
                    extractContextGenerics(records, assign.type(), null, [], true);
                }
            });
        }
    }else if(context.isIntersectionType){
        extractContextGenerics(records, context.left.type(), null, relateGenerics);
        extractContextGenerics(records, context.right.type(), null, relateGenerics);
    }else if(context.isUnionType){
        context.elements.forEach(item=>{
            extractContextGenerics(records, item.type(), null, relateGenerics);
        });
    }
}

function push(generic, type, records, force=false){
    if(type)type = type.type();
    if(type && generic!=type){
        if(force || !records.has(generic)){
            records.set(generic, type);
            return true;
        }
    }
    return false;
}

function extractMatchGenerics(records, declareGenerics, declareParams, assigmentArgs, assigmentGenerics, relateGenerics=[]){
    let len = assigmentArgs.length;
    let aLen = assigmentGenerics ? assigmentGenerics.length : 0;
    if(aLen>0){
        for(let i=0;i<declareGenerics.length;i++){
            let generic = declareGenerics[i].type();
            if(aLen>0 && i<aLen){
                let assigment = assigmentGenerics[i];
                push(generic, assigment, records, true);
                if(relateGenerics.length>0){
                    let index = findGenericIndex(relateGenerics, generic);
                    if(index>=0){
                        push(relateGenerics[index], assigment, records, true);
                    }
                }
            }
        }
    }

    let after = [];
    for(let i=0;i<len;i++){
        let declParamItem = declareParams.length>i ? declareParams[i] : null;
        let declParamType = null;
        if(declParamItem){
            declParamType = declParamItem.type();
        }

        if(!declParamType && declareParams.length>0){
            declParamItem = declareParams[declareParams.length-1];
            declParamType = declParamItem.type();
            if(declParamType && declParamType.isTupleType && declParamType.rest && declParamType.prefix){
            }else{
                declParamType = null;
            }
        }
        if(!declParamType)break;

        const paramTypes = declParamType.isUnionType ? declParamType.elements.map(item=>item.type()) : [declParamType];

        for(let index=0; index<paramTypes.length;index++){
            let declParamType = paramTypes[index];
            if(declParamType.isFunctionType){
                after.push([declParamItem, declParamType, assigmentArgs[i], i]);
            }else if(declParamType.hasGenericType){
                let declParamGenerics = extractGenericsFromType(declParamType);
                let assigmentArg = assigmentArgs[i];
                if(declParamType.isTupleType && declParamType.rest && declParamType.prefix){
                    let items = assigmentArgs.slice(i).map(item=>item.type());
                    assigmentArg = items.length>1 ? MergeType.arrayToUnion(items) : items[0];
                    declParamType = declParamType.elements[0].type();
                }
                if(declParamType.isClassGenericType){
                    extractContextGenerics(records, declParamType);
                    let pos = declParamGenerics.findIndex(generic=>{
                        return findGenericIndex(declareGenerics, generic) < 0;
                    });
                    if(pos>=0){
                        let external = declParamGenerics[pos];
                        let result = getAssigmentBoundType(external, declParamType, assigmentArg);
                        if(result){
                            declParamGenerics.forEach(paramGeneric=>{
                                if(paramGeneric===external)return;
                                let index = findGenericIndex(declareGenerics, paramGeneric);
                                if(index<0)return;
                                if(assigmentGenerics && assigmentGenerics.length>0 && assigmentGenerics[index]){
                                    push(paramGeneric, assigmentGenerics[index],records,true);
                                }else{
                                    push(paramGeneric,result,records);
                                }
                            });
                            break;
                        }
                    }
                }
                let boundValue = null;
                declParamGenerics.forEach(paramGeneric=>{
                    let index = findGenericIndex(declareGenerics, paramGeneric);
                    if(index<0)return;
                    let assigmentResult = null;
                    if(assigmentGenerics && assigmentGenerics.length>0 && assigmentGenerics[index]){
                        assigmentResult = assigmentGenerics[index]
                        push(paramGeneric, assigmentResult, records, true);
                    }else{
                        assigmentResult = boundValue || getAssigmentBoundType(paramGeneric, declParamType, assigmentArg);
                        push(
                            paramGeneric,
                            boundValue = assigmentResult,
                            records
                        );
                    }
                    if(paramGeneric.hasConstraint){
                        const constraint = paramGeneric.inherit.type();
                        const result = constraint.isClassGenericType && constraint.isClassType && Utils.isClassType(assigmentResult)
                        if(result || constraint.isClassGenericType && constraint.is(assigmentResult)){
                            let declareGenerics = constraint.types.filter(item=>item.type().isInferGenericType)
                            if(declareGenerics.length>0){
                                extractMatchGenerics(records, declareGenerics, [constraint], [assigmentResult])
                            }
                        }
                    }
                });
            }

        }
    }

    after.forEach(([declParamItem, declParamType, assigmentArg])=>{
        let declReturnType = declParamType.getReturnedType();
        if(declReturnType && !declReturnType.isVoidType && declReturnType.hasGenericType ){
            let assigmentType = assigmentArg.type();
            if(assigmentType && assigmentType.isFunctionType){
                let assigmentReturnType = assigmentType.getInferReturnType();
                if(assigmentReturnType && !assigmentReturnType.isVoidType){
                    let extractReturnGenerics = extractGenericsFromType(declReturnType);
                    let boundValue = null;
                    extractReturnGenerics.forEach( generic=>{
                        let index = findGenericIndex(declareGenerics, generic);
                        if(index<0)return;
                        if(assigmentGenerics && assigmentGenerics.length>0){
                            push(generic, assigmentGenerics[index], records, true);
                        }else{
                            push(
                                generic,
                                boundValue = boundValue || getAssigmentBoundType(generic, declReturnType, assigmentReturnType),
                                records
                            );
                        }
                    })
                }
            }
        }
    });

    return records;
}

function getClassGenericsFromType(type){
    if(!type || !Utils.isType(type))return [];
    if(type.isClassGenericType && Array.isArray(type.types) && type.types.length>0){
        return [type]
    }else if(type.isUnionType){
        return type.elements.map(el=>getClassGenericsFromType(el.type())).flat();
    }else if(type.isIntersectionType){
        return [type.left, type.right].map(el=>getClassGenericsFromType(el.type())).flat();
    }
    return [];
}

function getCalleeStack(stack){
    if(stack.isParenthesizedExpression){
        return getCalleeStack(stack.expression);
    }
    return stack;
}

function make(stack){
    let origin = null;
    let records = null;
    let post = null;
    if(stack.isCallExpression){
        const description = stack.descriptor();
        const [declareGenerics=[]] = description ? stack.getDeclareGenerics(description) : [];
        const declareParams = stack.getFunDeclareParams(description);
        const assigmentGenerics = stack.genericity;
        const args = stack.arguments;
        const type = stack.getReturnType();
        const relateGenerics = extractGenericsFromType(type);
        const callee = getCalleeStack(stack.callee);
        let context = callee.isMemberExpression ? callee.object.type() : null;
        let _thisArg = description ? description.thisArgumentContext : null;
        records= new Map();
        if(!context && stack.is(description)){
            if(Utils.isModule(description.module)){
                if(description.isCallDefinition){
                    context = stack.callee.type();
                    origin =  Utils.getOriginType(context);
                }else if(Utils.isModule(stack.module)){
                    context = origin = stack.module;
                }
            }
        }else if(context){
            origin =  Utils.getOriginType(context);
        }

        const pushThisCtx = ()=>{
            if(_thisArg){
                const type = _thisArg.type();
                if(type && type.isGenericType && (!type.hasConstraint || type.is(context))){
                    push(type, context, records, true)
                }
            }
        }

        extractContextGenerics(records, context, origin, relateGenerics);
        if(declareGenerics.length>0){
            post = ()=>{
                extractMatchGenerics(
                    records,
                    declareGenerics.map(item=>item.type()),
                    declareParams,
                    args,
                    assigmentGenerics,
                    relateGenerics
                );
                extractContextGenerics(records, type, null, relateGenerics)
                pushThisCtx()
            }
        }else{
            pushThisCtx()
        }

    }else if(stack.isNewExpression){
        const [classModule,methodConstructor, _assigmentGenerics=[]] = stack.getConstructMethod() || [];
        let callee = getCalleeStack(stack.callee);
        let context = callee.isMemberExpression ? callee.object.type() : null;
        records= new Map();
        if(context){
            extractContextGenerics(records, context);
        }
        if(classModule){
            const [, declareGenerics=[]] = stack.getDeclareGenerics(classModule, methodConstructor);
            const declareParams  = methodConstructor ? methodConstructor.params : [];
            const assigmentGenerics = stack.genericity || _assigmentGenerics;
            origin = Utils.getOriginType(classModule);
            // if(!Utils.isModule(origin)){
            //     origin = null;
            // }
            if(assigmentGenerics.length>0){
                declareGenerics.forEach((decl,index)=>{
                    push(decl.type(),assigmentGenerics[index],records,true);
                })
            }
            if(declareGenerics.length>0){
                post = ()=>{
                    extractMatchGenerics(
                        records,
                        declareGenerics.map(item=>item.type()),
                        declareParams,
                        stack.arguments,
                        assigmentGenerics
                    );
                }
            }
        }
    }else if(stack.isMemberExpression){
        const type = stack.object.type();
        const relateGenerics = extractGenericsFromType(type);
        origin = Utils.getOriginType(type);
        // if(!Utils.isModule(origin)){
        //     origin = null;
        // }
        records= new Map();
        extractContextGenerics(
            records,
            type,
            origin,
            relateGenerics
        );
    }else if(stack.isVariableDeclarator || stack.isParamDeclarator || stack.isPropertyDefinition || stack.isFunctionExpression && stack.parentStack.isMethodDefinition){
        let type = stack.type();
        if((stack.isPropertyDefinition || stack.isFunctionExpression || stack.isParamDeclarator && stack.parentStack.parentStack.isMethodDefinition) && stack.module){
            origin = stack.module;
        }else{
            origin = Utils.getOriginType(type);
            // if(!Utils.isModule(origin)){
            //     origin = null;
            // }
        }
        records= new Map();
        extractContextGenerics(
            records,
            type,
            origin
        );
    }
    return {records, origin, post};
}

let currentStack = null;
function create(stack, parent=null){
    currentStack = stack;
    if(parent && !isInfer(parent)){
        throw new Error("Invalid parent");
    }
    return new Inference(stack, parent)
}

function getInferenceFromType(type, parent=null){
    if(parent && !isInfer(parent)){
        throw new Error("Invalid parent");
    }
    let obj = new Inference(null, parent);
    obj.make(type)
    return obj
}

function isInfer(obj){
    return obj ? obj instanceof Inference : false;
}

let unknown = null;
class Inference{
    [Utils.IS_CONTEXT]=true;
    #stack = null;
    #records = null;
    #origin = null;
    #parent = null;
    #group = null;
    #inited = false;
    #making = false;
    #hoverStack = null;
    constructor(stack, parent=null){
        this.#stack = stack;
        this.#parent = parent;
    }
    get stack(){
        return this.#stack;
    }
    get records(){
        return this.#records;
    }
    get origin(){
        return this.#origin;
    }
    get parent(){
        return this.#parent;
    }
    get hoverStack(){
        return this.#hoverStack || this.stack;
    }
    setHoverStack(stack){
        this.#hoverStack = stack;
    }
    init(){
        if(this.#inited===false){
            this.#inited = true;
            this.#making = true;
            let result = make(this.stack);
            this.#records = result.records;
            this.#origin = result.origin;
            let post = result.post;
            if(post){
                post()
            }
            this.#making = false;
        }
    }
    make(type){
        if(!Utils.isType(type)){
            throw new Error('Invalid type in the make inference context ')
        }
        this.#inited = true;
        let origin = Utils.getOriginType(type);
        if(!Utils.isModule(origin)){
            origin = null;
        }
        this.#records =  new Map();
        this.#origin = origin;
        extractContextGenerics(this.#records, type);
    }

    fetchOriginAssign(generic, origin){
        if(origin){
            if(Utils.isModule(origin)){
                const result = origin.getAssignGenerics(generic);
                if(result && result !== generic){
                    return result;
                }
            }
            if(origin.isUnionType){
                const items = origin.elements;
                for(let i=0;i<items.length;i++){
                    let item = items[i].type();
                    const result = this.fetchOriginAssign(generic, item);
                    if(result){
                        return result;
                    }
                }
            }else if(origin.isIntersectionType){
                const result = this.fetchOriginAssign(generic, origin.left.type()) || this.fetchOriginAssign(generic, origin.right.type());
                if(result){
                    return result;
                }
            }
        }
        return null;
    }

    fetch(generic, flag=false){
        if(!generic){
            throw new Error("Generic cannot is null")
        }
        //防止死循环调用
        let recursion = 0;
        const getValue = (generic, flag=false)=>{
            if(generic.isGenericType){
                if(recursion>=100){
                    return flag ? generic : null;
                }
                let records = this.#records;
                if(records && records.has(generic)){
                    const value = records.get(generic);
                    if(value !== generic){
                        recursion++;
                        return getValue(value, true);
                    }
                }
                
                let assign = this.fetchOriginAssign(generic, this.#origin);
                if(assign && assign !== generic){
                    recursion++;
                    return getValue(assign, true);
                }
                
                let parent = this.#parent;
                if(parent){
                    const result = parent.fetch(generic);
                    if(result){
                        return result;
                    }
                }
                return flag ? generic : null;
            }
            return generic;
        }
        const result = getValue(generic);
        if(result)return result;
        return flag ? generic : null;
    }
    infer(generic, flag=false){
        if(!generic){
            throw new Error("Generic cannot is null")
        }
        let result = this.fetch(generic);
        if(!result){
            if(generic.assignType){
                result = generic.assignType.type();
            }else if(generic.hasConstraint){
                result = generic.inherit.type();
            }
            if(result){
                if(result.isGenericType){
                    return this.infer(result, true);
                }
                return result;
            }
            if(flag){
                return generic;
            }
            return unknown || (unknown = Namespace.globals.get("unknown"));
        }else if(result.isGenericType){
            if(result.assignType){
                result = result.assignType.type();
            }else if(result.hasConstraint){
                result = result.inherit.type();
            }
        }
        return result;
    }
    get inference(){
        return (generic)=>this.infer(generic);
    }
    apply(type){
        if(!Utils.isType(type)){
            throw new Error("Type object is invalid")
        }
        const result = type.getInferResult(this)
        if(result){
            type = result;
        }
        if(type.hasGenericType){
            return type.clone(this.inference);
        }
        return type;
    }
    create(stack, type=null){
        if(!type && (Utils.isStack(stack) || Utils.isType(stack))){
            type = stack.type();
        }
        if(!type){
            throw new Error("Type cannot is null of the create child context")
        }
        let group = this.#group || (this.#group=new Map())
        if(stack && group.has(stack)){
            return group.get(stack);
        }
        let items = getClassGenericsFromType(type);
        if(items.length>0){
            let records = new Map();
            items.forEach(type=>{
                let classDeclareGenerics = getTypeDeclareGenerics(type);
                classDeclareGenerics.forEach((decl,index)=>{
                    push(decl, type.types[index], records, true)
                });
            })
            let child = new Inference(stack, this);
            child.#records = records;
            child.#inited = true;
            if(stack){
                group.set(stack, child);
            }
            return child
        }
        return this
    }

    createChild(stack){
        let child = new Inference(stack, this);
        child.#records = null;
        child.#inited = true;
        return child;
    }

    debug(){
        let records = this.#records;
        let stack = this.stack;
        let file = null;
        let line = null;
        if(Utils.isStack(stack)){
            file = stack.file;
            let loc = stack.getLocation();
            line = loc ? loc.start.line : null;
        }
        let items = [file, line].filter(Boolean);
        let info = items.length>0 ? items.join(':') : 'unknown';
        let making = this.#making ? 'making' : 'done';
        if(!records){
            console.log(`[debug inference] [records is null] [${making}] file:${info}`);
        }else{
            console.log(`[debug inference] [total:${records.size}] [${making}] file:${info}`)
            records.forEach((value, key)=>{
                if(value.isGenericType){
                    console.log(key.getUniKey(), `${value.getUniKey()}(${value.toString()})`)
                }else{
                    console.log(key.getUniKey(), value.toString())
                }
            })
            let origin = this.#origin;
            if(origin && Utils.isModule(origin)){
                console.log(`[debug inference] [origin]`)
                origin.getAllAssignGenerics().forEach((value, key)=>{
                    if(value.isGenericType){
                        console.log(key, `${value.getUniKey()}(${value.toString()})`)
                    }else{
                        console.log(key, value.toString())
                    }
                })
            }
        }
        let parent = this.#parent;
        if(parent){
            parent.debug();
        }
    }
    append(type){
        if(Utils.isType(type)){
            this.#records = this.#records || (this.#records=new Map());
            extractContextGenerics(this.#records, type);
        }
    }
    inCallChain(){
        let stack = this.#stack;
        if(stack.isCallExpression || stack.isNewExpression){
            return true;
        }
        let parent = this.#parent;
        return parent ? parent.inCallChain() : false;
    }
}

module.exports = {
    create,
    getInferenceFromType,
    isInfer,
    getCalleeStack,
    extractWrapGenericValue,
    getTypeDeclareGenerics,
    extractContextGenerics,
    extractMatchGenerics,
    extractGenericsFromType,
    getComputeValue
};