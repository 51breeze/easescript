const Namespace = require("./Namespace")
const MergeType = require('./MergeType');
const Utils = require("./Utils");

function extractGenericsFromType(type){
    if(type.isGenericType)return [type];
    if(type.isAliasType){
        return extractGenericsFromType(type.inherit.type());
    }
    let elements = null;
    if(type.isLiteralObjectType){
        elements = Array.from(type.properties.values());
    }else if(type.isLiteralArrayType || type.isTupleType || type.isUnionType){
        elements = type.elements;
    }else if(type.isClassGenericType && Array.isArray(type.types)){
        elements = type.types;
    }else if(type.isIntersectionType){
        elements = [type.left, type.right];
    }else if(type.isInstanceofType && Array.isArray(type.generics)){
        elements = type.generics;
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

function getAssigmentBoundType(generics, declared, assigment){
    let assigmentType = assigment.type();
    if(declared.isGenericType){
        if(generics.getUniKey() === declared.getUniKey()){
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
                            let res = getAssigmentBoundType(generics, _declared, assigmentPropertry);
                            if(res){
                                return res;
                            }
                        }
                    }
                }
            }
        }
    }else if(declared.isLiteralObjectType){
        if(assigmentType.isLiteralObjectType){
            let keys =declared.properties.keys();
            for(let key of keys){
                let property = declared.properties.get(key);
                let assigmentProperty = assigmentType.properties.get(key);
                if(assigmentProperty){
                    let propertyType = property.type();
                    if(propertyType.hasGenericType){
                        let res = getAssigmentBoundType(generics, propertyType, assigmentProperty);
                        if(res){
                            return res;
                        }
                    }
                }
            }
        }else if(assigmentType.isIntersectionType){
            let res = getAssigmentBoundType(generics, declared, assigmentType.left) || getAssigmentBoundType(generics, declared, assigmentType.right);
            if(res){
                return res;
            }
        }else{
            let keys =declared.properties.keys();
            for(let key of keys){
                let property = declared.properties.get(key);
                let res = getAssigmentBoundType(generics, property.type(), assigmentType);
                if(res){
                    return res;
                }
            }
        }
    }else if(declared.isTupleType){
        let elements = declared.elements;
        if(declared.prefix && assigmentType.isTupleType && assigmentType.prefix){
            return getAssigmentBoundType(generics, elements[0].type(), assigmentType.elements[0].type());
        }else if(declared.prefix && (assigmentType.isLiteralArrayType || (assigmentType.isTupleType && !assigmentType.prefix))){
            let results = assigmentType.elements;
            if(results.length>0){
                let constraint = elements[0].type();
                if(constraint.isGenericType){
                    if(generics.getUniKey() === constraint.getUniKey()){
                        return results.length>1 ? MergeType.arrayToUnion(results) : results[0].type();
                    }
                }
                declared = elements[0].type();
                for(let i=0;i<results.length;i++){
                    let res = getAssigmentBoundType(generics, declared, results[i]);
                    if(res){
                        return res;
                    }
                }
            }
        }else if(assigmentType.isLiteralArrayType || assigmentType.isTupleType){
            let results =  assigmentType.elements;
            for(let i=0;i<elements.length;i++){
                let el = elements[i];
                let assign = results[i];
                if(!assign && assigmentType.isTupleType && assigmentType.prefix){
                    assign = results[0];
                }
                if(assign){
                    declared = el.type();
                    if(declared.hasGenericType){
                        let res = getAssigmentBoundType(generics, declared, assign);
                        if(res){
                            return res;
                        }
                    }
                }else{
                    break;
                }
            }
        }else if(declared.prefix){
            return getAssigmentBoundType(generics, elements[0].type(), assigmentType);
        }else{
            for(let i=0;i<elements.length;i++){
                let el = elements[i];
                let res = getAssigmentBoundType(generics, el.type(), assign);
                if(res){
                    return res;
                }
            }
        }
    }else if(declared.isUnionType){
        let elements = declared.elements;
        for(let i=0;i<elements.length;i++){
            let el = elements[i];
            let res = getAssigmentBoundType(generics, el.type(), assigmentType);
            if(res){
                return res;
            }
        }
    }else if(declared.isIntersectionType){
        return getAssigmentBoundType(generics, declared.left.type(), assigmentType) || getAssigmentBoundType(generics, declared.right.type(), assigmentType);
    }else if(declared.isClassGenericType){
        let types = declared.types;
        for(let i=0;i<types.length;i++){
            let el = types[i].type();
            if(el.hasGenericType){
                let res = getAssigmentBoundType(generics, el, assigmentType);
                if(res){
                    return res;
                }
            }
        }
        const wrap = declared.inherit.type();
        if(wrap.hasGenericType){
            return getAssigmentBoundType(generics, wrap, assigmentType);
        }
    }
    return null;
}

function findGenericsIndex(generics, generic){
    return generics.findIndex(decl=>generic.getUniKey() === decl.type().getUniKey());
}

function findMatchTypeByGenerics(declareGenerics, declareParams, assigmentArgs, assigmentGenerics, type, context, stack){
   
    let needMatchGenericsItems = extractGenericsFromType(type);
    if(!needMatchGenericsItems.length)return null;

    let len = assigmentArgs.length;
    let records = new Map();
    let push = (generic, type, removeAt=null)=>{
        if(type)type = type.type();
        if(type && generic != type){
            records.set(generic, type);
            if(removeAt>=0){
                needMatchGenericsItems.splice(removeAt, 1);
            }
            return true;
        }
        return false;
    }

    if(assigmentGenerics && assigmentGenerics.length>0){
        for(let i=0;i<needMatchGenericsItems.length;i++){
            let generic = needMatchGenericsItems[i];
            let index = findGenericsIndex(declareGenerics, generic);
            if(index>=0 && push(generic, assigmentGenerics[index], i)){
                i--;
            }
        }
    }

    if(stack.file && stack.file.includes("src/test/ForOf.es") && stack.node.loc.start.line===35){
        console.log("==================================", needMatchGenericsItems[0].getUniKey() )
    }

    if(needMatchGenericsItems.length>0 && context){
        let origin = Utils.getOriginType(context);
        if(Utils.isModule(origin)){
            let classDeclareGenerics = origin.getModuleDeclareGenerics();
            if(context.isTupleType){
                let assigmentType = context.prefix ? context.elements[0].type() : MergeType.arrayToUnion(context.elements);
                let index = needMatchGenericsItems.findIndex(generic=>{  
                    return classDeclareGenerics.some(decl=>decl.type().getUniKey()===generic.getUniKey());
                });
                if(index>=0){
                    push(needMatchGenericsItems[index], assigmentType, index);
                }
            }else if(context.isInstanceofType){

                if(context.generics && context.generics.length>0){
                    for(let index =0; index<needMatchGenericsItems.length; index++){
                        let generic = needMatchGenericsItems[index];
                        let pos = findGenericsIndex(classDeclareGenerics, generic);
                        if(pos<0){
                            let assign = origin.getAssignGenerics(generic);
                            if(assign && assign.isGenericType){
                                pos = findGenericsIndex(classDeclareGenerics, assign);
                            }
                        }
                        if(context.generics[pos]){
                            if(push(needMatchGenericsItems[index], context.generics[pos], index)){
                                index--;
                            }
                        }
                    }
                }

                for(let index =0; index<needMatchGenericsItems.length; index++){
                    let generic = needMatchGenericsItems[index];
                    let res = origin.getAssignGenerics(generic);
                    if(push(generic, res, index)){
                       index--;
                    }
                }
            }
        }
    }

    if(!needMatchGenericsItems.length)return records;
    for(let i=0;i<len;i++){
        if(!needMatchGenericsItems.length)break;
        let declParamType = declareParams.length>i ? declareParams[i].type() : null;
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
            let defReturnType = declParamType.getReturnedType();
            if(defReturnType && !defReturnType.isVoidType && defReturnType.hasGenericType ){
                let assigmentType = assigmentArgs[i].type();
                if(assigmentType && assigmentType.isFunctionType){
                    let assigmentReturnType = assigmentType.getInferReturnType();
                    if(assigmentReturnType && !assigmentReturnType.isVoidType){
                        let extractReturnGenerics = extractGenericsFromType(defReturnType);
                        extractReturnGenerics.forEach( defGeneric=>{
                            let index = findGenericsIndex(needMatchGenericsItems, defGeneric);
                            if(index>=0){  
                                push(
                                    needMatchGenericsItems[index],
                                    getAssigmentBoundType(defGeneric, defReturnType, assigmentReturnType),
                                    index
                                );
                            }
                        })
                    }
                }
            }
        }else if(declParamType.hasGenericType){
            let declParamGenerics = extractGenericsFromType(declParamType);
            declParamGenerics.forEach(paramGeneric=>{
                let index = findGenericsIndex(needMatchGenericsItems, paramGeneric);
                if(index>=0){
                    push(
                        needMatchGenericsItems[index],
                        getAssigmentBoundType(paramGeneric, declParamType, assigmentArgs[i]),
                        index
                    );
                }
            });
        }
    }
    return records;
}

function hasInhriteDeclareGenerics(module, generic){
    if(!module)return false;
    let classDeclareGenerics = module.getModuleDeclareGenerics();
    if(classDeclareGenerics.some(decl=>decl.getUniKey()===generic.getUniKey())){
        return true;
    }
    if(module.inherit && hasInhriteDeclareGenerics(module.inherit, generic)){
        return true;
    }
    return module.implements.some(imp=>hasInhriteDeclareGenerics(imp, generic));
}

function callReturnType(stack, type){
    let description = stack.descriptor();
    let [declareGenerics] = stack.getDeclareGenerics(description);
    let declareParams = stack.getFunDeclareParams(description);
    let assigmentGenerics = stack.genericity;
    let args = stack.arguments;

    let context = stack.callee.isMemberExpression ? stack.callee.object.type() : null;
    if(!context && stack.is(description) && Utils.isModule(description.module) && Utils.isModule(stack.module)){
        context = stack.module;
    }

    let results = findMatchTypeByGenerics(declareGenerics, declareParams, args, assigmentGenerics, type, context, stack);
    let callback = generics=>{
        if(generics.isGenericType){
            if(results && results.has(generics)){
                return callback(results.get(generics))
            }
            return Namespace.globals.get("unknown");
        }
        return generics;
    }
    return type.clone(callback);
}

function infer(stack){
    if(stack.isCallExpression){
        let type = stack.getReturnType();
        if(type.hasGenericType){
            return callReturnType(stack, type)
        }
    }
}

module.exports = infer;