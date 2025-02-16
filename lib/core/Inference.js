const Namespace = require("./Namespace")
const MergeType = require('./MergeType');
const Utils = require("./Utils");
const isInferenceKey = Symbol('this is Inference');
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
        if(inherit.isAliasType){
            elements.push(inherit);
        }
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
            let type = item.type();
            if(type.hasGenericType){
                return extractGenericsFromType(type);
            }
            return [];
        }).flat();
    }
    return [];
}

function getTypeDeclareGenerics(type){
    if(type.isAliasType && type.target && type.target.isDeclaratorTypeAlias && type.target.genericity){
        return type.target.genericity.elements.map(item=>item.type());
    }else if(type.isClassGenericType && type.target && type.target.isTypeGenericDefinition){
        return type.target.getDeclareGenerics()[1].map(item=>item.type());
    }else if(type.isInstanceofType){
        type = type.inherit.type();
    }
    let origin = Utils.getOriginType(type);
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

function getAssigmentBoundType(generic, declared, assigment){
    let assigmentType = assigment.type();
    if(assigmentType.isTypeofType){
        assigmentType = assigmentType.origin.type();
    }
    if(declared.isGenericType){
        if(generic.getUniKey() === declared.getUniKey()){
            if(assigmentType.isLiteralArrayType){
                return MergeType.to(assigmentType, false, false, needToLiteralValue(generic))
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
        let getProperty = (target, key)=>{
            if(target.isLiteralObjectType){
                return target.properties.get(key);
            }else if(target.isIntersectionType){
                return getProperty(target.left, key) || getProperty(target.right, key);
            }else if(target.isInstanceofType){
                let inherit = target.inherit.type();
                if(inherit.isClassGenericType && inherit.isClassType && target.target.isNewExpression){
                    inherit = inherit.elements[0].type();
                }
                let descriptors = inherit.descriptors.get(key);
                if(descriptors){
                    let properties = descriptors.filter(item=>item.isPropertyDefinition).map(item=>item.type());
                    return properties.length>1 ? MergeType.arrayToUnion(properties) : properties[0];
                }
            }
        }
        for(let key of keys){
            let properties = declared.descriptors.get(key);
            for(let i=0;i<properties.length;i++){
                let property = properties[i];
                if(property.isPropertyDefinition){
                    let _declared = property.type();
                    if(assigmentType.isLiteralObjectType && _declared.hasGenericType){
                        let assigmentPropertry = getProperty(assigmentType,key);
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
        if(assigmentType.isLiteralObjectType || assigmentType.isEnumType){
            let keys =declared.properties.keys();
            for(let key of keys){
                let property = declared.properties.get(key);
                let assigmentProperty = assigmentType.attribute(key);
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
        }else if(assigmentType.isIntersectionType){
            let res = getAssigmentBoundType(generic, declared, assigmentType.left) || getAssigmentBoundType(generic, declared, assigmentType.right);
            if(res){
                return res;
            }
        }else{
            let keys =declared.properties.keys();
            for(let key of keys){
                let property = declared.properties.get(key);
                let res = getAssigmentBoundType(generic, property.type(), assigmentType);
                if(res){
                    return res;
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
        for(let i=0;i<elements.length;i++){
            let el = elements[i];
            let res = getAssigmentBoundType(generic, el.type(), assigmentType);
            if(res){
                return res;
            }
        }
    }else if(declared.isIntersectionType){
        return getAssigmentBoundType(generic, declared.left.type(), assigmentType) || getAssigmentBoundType(generic, declared.right.type(), assigmentType);
    }else if(declared.isClassGenericType){
        if(assigmentType.isClassGenericType){
            if(declared.inherit.type().is(assigmentType.inherit.type())){
                let declareGenerics = getTypeDeclareGenerics(declared.inherit.type());
                let index = declareGenerics.findIndex(decl=>decl.getUniKey()===generic.getUniKey())
                if(index>=0 && assigmentType.types[index]){
                    return assigmentType.types[index].type();
                }
            }else{
                return MergeType.arrayToUnion(assigmentType.types);
            }
        }else{
            const inherit = declared.inherit.type();
            if(inherit.isAliasType){
                return getAssigmentBoundType(generic, inherit, assigmentType);
            }else{
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
                if(inherit.hasGenericType){
                    return getAssigmentBoundType(generic, inherit, assigmentType);
                }
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

function extractMatchGenerics(declareGenerics, declareParams, assigmentArgs, assigmentGenerics, type, context, origin){
    let needMatchGenericsItems = extractGenericsFromType(type);
    let len = assigmentArgs.length;
    let records = new Map();
    let push = (generic, type)=>{
        if(type)type = type.type();
        if(type && generic!=type && !records.has(generic)){
            records.set(generic, type);
            return true;
        }
        return false;
    }

    if(len==0 && assigmentGenerics && assigmentGenerics.length>0){
        for(let i=0;i<declareGenerics.length;i++){
            let generic = declareGenerics[i].type();
            let index = findGenericIndex(needMatchGenericsItems, generic);
            if(index>=0){
                push(needMatchGenericsItems[index], assigmentGenerics[i]);
            }else{
                push(generic, assigmentGenerics[i]);
            }
        }
    }

    if(context){
        if(context.isAliasType){
            context = context.inherit.type();
        }
        if(Utils.isModule(origin)){
            let classDeclareGenerics = getTypeDeclareGenerics(context);
            if(context.isTupleType || context.isLiteralArrayType){
                let assigmentType = context.elements.length>0 ? 
                    context.isTupleType && context.prefix ? 
                        context.elements[0].type() : 
                            MergeType.arrayToUnion(context.elements) : 
                                Namespace.globals.get('any');
                classDeclareGenerics.forEach(decl=>{
                    let index = findGenericIndex(needMatchGenericsItems, decl);
                    if(index>=0){
                        push(needMatchGenericsItems[index], assigmentType);
                    }else{
                        push(decl, assigmentType);
                    }
                });
            }else if(context.isInstanceofType){
                if(context.generics && context.generics.length>0){
                    classDeclareGenerics.forEach((decl,pos)=>{
                        let index = findGenericIndex(needMatchGenericsItems, decl);
                        if(index>=0){
                            push(needMatchGenericsItems[index], context.generics[pos]);
                        }else{
                            push(decl, context.generics[pos])
                        }
                    });
                }
            }else if(context.isClassGenericType){
                if(context.types && context.types.length>0){
                    classDeclareGenerics.forEach((decl,pos)=>{
                        let index = findGenericIndex(needMatchGenericsItems, decl);
                        if(index>=0){
                            push(needMatchGenericsItems[index], context.types[pos]);
                        }else{
                            push(decl, context.types[pos])
                        }
                    });
                }
            }
        }
    }

    for(let i=0;i<len;i++){
        let declParamItem = declareParams.length>i ? declareParams[i] : null;
        let declParamType = null;
        if(declParamItem){
            if(declParamItem.isArrayPattern){
                declParamType = declParamItem.acceptType?.type();
            }else if(declParamItem.isObjectPattern){
                declParamType = declParamItem.acceptType?.type();
            }else{
                declParamType = declParamItem.type();
            }
        }

        if(!declParamType){
            declParamType = declareParams[declareParams.length-1];
            if(declParamType.isTupleType && declParamType.rest && declParamType.prefix){
                declParamType = declParamType.elements[0].type();
            }else{
                declParamType = null;
            }
        }

        if(!declParamType)break;
        if(declParamType.isFunctionType){
            let declReturnType = declParamType.getReturnedType();
            if(declReturnType && !declReturnType.isVoidType && declReturnType.hasGenericType ){
                let assigmentType = assigmentArgs[i].type();
                if(assigmentType && assigmentType.isFunctionType){
                    let assigmentReturnType = assigmentType.getInferReturnType();
                    if(assigmentReturnType && !assigmentReturnType.isVoidType){
                        let extractReturnGenerics = extractGenericsFromType(declReturnType);
                        let boundValue = null;
                        extractReturnGenerics.forEach( generic=>{
                            let index = findGenericIndex(declareGenerics, generic);
                            if(index<0)return;
                            if(assigmentGenerics && assigmentGenerics.length>0){
                                push(generic, assigmentGenerics[index]);
                            }else{
                                push(
                                    generic,
                                    boundValue = boundValue || getAssigmentBoundType(generic, declReturnType, assigmentReturnType)
                                );
                            }
                        })
                    }
                }
            }
        }else if(declParamType.hasGenericType){
            let declParamGenerics = extractGenericsFromType(declParamType);
            let assigmentArg = assigmentArgs[i];
            if(declParamType.isTupleType && declParamType.rest && declParamType.prefix){
                assigmentArg = MergeType.arrayToUnion(assigmentArgs.slice(i).map(item=>item.type()));
                declParamType = declParamType.elements[0].type();
            }

            if(declParamType.isClassGenericType){
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
                                push(paramGeneric, assigmentGenerics[index]);
                            }else{
                                push(paramGeneric,result);
                            }
                        });
                        continue;
                    }
                }
            }

            let boundValue = null;
            declParamGenerics.forEach(paramGeneric=>{
                let index = findGenericIndex(declareGenerics, paramGeneric);
                if(index<0)return;
                if(assigmentGenerics && assigmentGenerics.length>0 && assigmentGenerics[index]){
                    push(paramGeneric, assigmentGenerics[index]);
                }else{
                    push(
                        paramGeneric,
                        boundValue = boundValue || getAssigmentBoundType(paramGeneric, declParamType, assigmentArg),
                    );
                }
            });
        }
    }

    return records;
}

function create(stack){
    let origin = null;
    let records = null;
    if(stack.isCallExpression){
        const description = stack.descriptor();
        const [declareGenerics=[]] = stack.getDeclareGenerics(description);
        const declareParams = stack.getFunDeclareParams(description);
        const assigmentGenerics = stack.genericity;
        const args = stack.arguments;
        const type = stack.getReturnType();
        let context = stack.callee.isMemberExpression ? stack.callee.object.type() : null;
        if(!context && stack.is(description) && Utils.isModule(description.module) && Utils.isModule(stack.module)){
            context = stack.module;
        }
        origin = context ? Utils.getOriginType(context) : null;
        records = extractMatchGenerics(
            declareGenerics.map(item=>item.type()),
            declareParams,
            args,
            assigmentGenerics,
            type,
            context,
            origin
        );
    }
    let recursion = generic=>{
        if(generic.isGenericType){
            if(records && records.has(generic)){
                return recursion(records.get(generic))
            }
            if(origin){
                let assign = origin.getAssignGenerics(generic);
                if(assign){
                    return recursion(assign);
                }
            }
            if(generic.assignType){
                return generic.assignType.type();
            }
            return Namespace.globals.get("unknown");
        }
        return generic;
    }
    recursion[isInferenceKey] = true;
    return {
        infer:recursion,
        apply(type){
            if(!Utils.isType(type)){
                throw new Error("Type object is invalid")
            }
            if(type.hasGenericType){
                return type.clone(recursion);
            }
            return type;
        }
    }
}

function isInfer(inference){
    return inference ? !!inference[isInferenceKey] : false;
}

module.exports = {
    create,
    isInfer,
    getComputeValue
};