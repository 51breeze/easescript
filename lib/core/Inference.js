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

function findMatchTypeByGenerics(declareGenerics, declareParams, args, assigmentGenerics, type, classDeclareGenerics){
    let len = args.length;
    let generics = extractGenericsFromType(type).filter(generic=>{
        if(declareGenerics.some(decl=>decl.type().getUniKey()===generic.getUniKey())){
            return true;
        }
        if(classDeclareGenerics){
            if(classDeclareGenerics.some(decl=>decl.type().getUniKey()===generic.getUniKey())){
                return true;
            }
        }
    });

    if(!generics.length)return null;
    let results = new Map();
    for(let i=0;i<len;i++){
        if(!generics.length)break;
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
                let assigmentType = args[i].type();
                if(assigmentType && assigmentType.isFunctionType){
                    let assigmentReturnType = assigmentType.getInferReturnType();
                    if(assigmentReturnType && !assigmentReturnType.isVoidType){
                        let extractReturnGenerics = extractGenericsFromType(defReturnType);
                        extractReturnGenerics.forEach( defGeneric=>{
                            let at = generics.findIndex(item=>item.getUniKey() === defGeneric.getUniKey());
                            if(at>=0){  
                                let res = getAssigmentBoundType(defGeneric, defReturnType, assigmentReturnType);
                                if(res){
                                    results.set(defGeneric, res);
                                    generics.splice(at, 1);
                                }
                            }
                        })
                    }
                }
            }
        }else if(declParamType.hasGenericType){
            let declParamGenerics = extractGenericsFromType(declParamType);
            declParamGenerics.forEach(paramGeneric=>{
                let at = generics.findIndex(item=>item.getUniKey() === paramGeneric.getUniKey());
                if(at<0)return;
                if(assigmentGenerics && assigmentGenerics.length>0){
                    let index = declareGenerics.findIndex(decl=>paramGeneric.getUniKey() === decl.type().getUniKey());
                    if(index>=0){
                        let res = assigmentGenerics[index];
                        if(res){
                            results.set(paramGeneric, res.type())
                            generics.splice(at, 1);
                        }else if(paramGeneric.assignType){
                            results.set(paramGeneric, paramGeneric.assignType.type())
                            generics.splice(at, 1);
                        }
                        return;
                    }
                }
                let res = getAssigmentBoundType(paramGeneric, declParamType, args[i]);
                if(res){
                    results.set(paramGeneric, res)
                    generics.splice(at, 1);
                }
            });
        }
    }
    return results
}

function callReturnType(stack, type){
    let description = stack.descriptor();
    let [declareGenerics] = stack.getDeclareGenerics(description);
    let declareParams = stack.getFunDeclareParams(description);
    let assigmentGenerics = stack.genericity;
    let args = stack.arguments;
    let classDeclareGenerics = null;
    if(stack.is(description) && Utils.isModule(description.module)){
        classDeclareGenerics = description.module.getModuleDeclareGenerics(false,true);
        if(classDeclareGenerics){
            classDeclareGenerics = classDeclareGenerics.elements;
        }
    }
    let results = findMatchTypeByGenerics(declareGenerics, declareParams, args, assigmentGenerics, type, classDeclareGenerics);
    return type.clone(generics=>{
        if(generics.isGenericType){
            if(results && results.has(generics)){
                return results.get(generics)
            }
            return Namespace.globals.get("unknown");
        }
    });
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