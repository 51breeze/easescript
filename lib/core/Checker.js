const Namespace = require("./Namespace");
const Utils = require("./Utils");
const defaultUnmatchHandler = (result)=>result;
function checkLiteralObjectConstraint(self, type, infer, handler){

    if(!Utils.isType(type))return false;
    type = infer(type);

    if( type.isAliasType ){
        return checkLiteralObjectConstraint(self, type.inherit.type(), infer, handler)
    }

    if(type.isLiteralArrayType || type.isTupleType){
        return false;
    }

    if( type.isUnionType ){
        return type.elements.every( item=>checkLiteralObjectConstraint(self, item.type(), infer, handler));
    }

    const qp = self.questionProperties || {};
    const isInterface = Utils.isInterface(type)
    if( !isInterface && !isBaseObject(type) ) {
        type = Utils.getOriginType(type);
        return type.isModule && type.id==='Object';
    }

    if(!(type.isLiteralObjectType || type.isIntersectionType || type.isGenericType || isInterface))return false;
   
    if(type.isLiteralObjectType && type.properties.size===0){
        return true;
    }

    if(self.properties.size===0 && self.dynamicProperties && self.dynamicProperties.size === 0 ){
        return true;
    }

    let result = false;
    if(self.properties.size>0){
        const properties = Array.from(self.properties);
        result = properties.every( item=>{
            const [name,base] = item;
            const acceptType = base.type();
            let right = null;
            if(isInterface){
                const result = type.getDescriptor(name, (desc)=>{
                    if(desc.isPropertyDefinition || desc.isMethodGetterDefinition){
                        return internalCheck(acceptType, desc.type(), infer, true, handler)
                    }
                    return false;
                });
                if(result){
                    return true
                }
            }else{
                right = type.attribute(name);
            }
            if(item===right)return true;
            if(!right){
                let question = !!qp[name];
                if(!question){
                    let origin = self.target && self.target.attribute(name);
                    question = origin ? !!origin.question : false;
                }
                return handler(question, acceptType, right);
            }
            return handler(internalCheck(acceptType, right, infer, true, handler), acceptType, right);
        });
    }else if(!isInterface){
        return true;
    }
    if(!result){
        result = checkDynamicProperties(self, type, infer, true, handler);
    }
    return handler(result, self, type);
}

const numberRegexp = /^\d+$/
function checkDynamicProperties(self, type, infer, constraint, handler){
    const properties = self.dynamicProperties;
    const attributes = type.attributes;
    if(!attributes || !properties)return false;
    if(!(properties instanceof Map))return false;
    if(!(attributes instanceof Map))return false;
    if(properties.size > 0 && attributes.size>0){
        let numberType = Namespace.globals.get('number');
        const entries = attributes.entries();
        for(let [key, value] of properties){
            let isProperty = Utils.isStack(value) && value.isProperty;
            if(!isProperty){
                throw new Error("Must is a Property");
            }
            const matchType = key.type();
            if(!matchType)continue;
            const acceptType = value.init.type();
            let hasMatched = false;
            for(const [name, property] of entries){
                if(matchType.is(numberType) && !numberRegexp.test(name)){
                    continue;
                }
                hasMatched = true;
                if(!handler(
                    internalCheck(
                        acceptType, property.type(),
                        infer,
                        constraint,
                        handler
                    ),
                    acceptType,
                    property
                )) {
                    return false;
                }
            }
            if(!hasMatched && !value.question){
                return false;
            }
        }
        return true;
    }
    return false
}


function checkLiteralObject(self, assingType, infer, constraint=false, unmatchHandler=null){

    function handler(result, acceptType, stack){
        if(unmatchHandler){
            return unmatchHandler(result, acceptType, stack)
        }
        return result;
    }
    
    

    function isBaseObject(type){
        type = type.isLiteralObjectType ? type.inherit : type;
        if(!type)return false;
        if(type.isIntersectionType){
            return isBaseObject(type.left.type()) || isBaseObject(type.right.type())
        }
        return self.inherit.is(type);
    }

    

    function is(type){
        if(!Utils.isType(type))return false;
        if(type.isFunctionType || type.isLiteralArrayType || type.isTupleType || Utils.isScalar(type))return false;
        if( type.isAliasType ){
            return is(type.inherit.type())
        }else if(type.isClassGenericType){
            const inherit = type.inherit.type();
            if( inherit.isAliasType ){
                return is(inherit);
            }
        }else if(type.isIntersectionType){
            return is(type.left.type()) || is(type.right.type());
        }
        if(type.isUnionType){
            return type.elements.every( item=>is(item.type()));
        }
        type = type.isLiteralObjectType ? type.inherit : type;
        return self.inherit.is(type);
    }
    return constraint ? check(assingType) : is(assingType);
}

function internalCheck(acceptType, assingType, inference, constraint, whenUnmatchHandler=null){
    if(acceptType.isLiteralObjectType){
        return checkLiteralObject(acceptType, assingType, inference.infer, constraint, whenUnmatchHandler)
    }
}

function create(stack, unmatchHandler=defaultUnmatchHandler){
    let inference = stack.getInference();
    let infer = (type)=>{
        if(type.isGenericType){
            return inference.infer(type)
        }
        return type;
    }

    function matcher(acceptType, assingType, constraint=false){
        return internalCheck(acceptType, assingType, infer, constraint, unmatchHandler)
    }

    function checker(acceptType, assingType, constraint=false){
        return internalCheck(acceptType, assingType, infer, constraint)
    }

    return {
        matcher,
        checker
    }
}

module.exports = {
    create
}