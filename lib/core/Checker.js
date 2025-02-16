const Namespace = require("./Namespace");
const Utils = require("./Utils");
const defaultUnmatchHandler = (result)=>result;
function checkLiteralObject(self, assingType, infer, strict=false, unmatchHandler=defaultUnmatchHandler){
    
    function constraint(type){
        if(!Utils.isType(type))return false;
        type = infer(type);

        if(type.isLiteralArrayType || type.isTupleType){
            return false;
        }

        if( type.isAliasType ){
            return constraint(type.inherit.type())
        }

        if( type.isUnionType ){
            return type.elements.every( item=>constraint(item.type()) );
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
                            return internalCheck(acceptType, desc.type(), infer, strict)
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
                    const origin = self.target && self.target.attribute(name);
                    const question = (origin && origin.question) || qp[name];
                    return unmatchHandler(!!question, acceptType, right);
                }
                return unmatchHandler(internalCheck(acceptType, right, infer, strict), acceptType, right);
            });
        }
        if(!result){
            result = checkDynamicProperties(type, !isInterface && this.properties.size==0);
        }
        return unmatchHandler(result, acceptType, type);
    }

    function isBaseObject(type){
        type = type.isLiteralObjectType ? type.inherit : type;
        if(!type)return false;
        if(type.isIntersectionType){
            return isBaseObject(type.left.type()) || isBaseObject(type.right.type())
        }
        return self.inherit.is(type);
    }

    function checkDynamicProperties(type, defaultResult=true){
        const properties = self.dynamicProperties;
        if( properties && properties.size > 0 ){
            let numberType = Namespace.globals.get('number');
            const regexp = /^\d+$/
            const entries = type.attributes.entries();

            let checkResult = true;
            for(let [key, value] of properties){
                const matchType = key.type();
                if(!matchType)continue;
                const acceptType = value.init.type();
                let hasMatched = false;
                for(const [name, property] of entries){
                    if(matchType.is(numberType) && !regexp.test(name) ){
                        continue;
                    }
                    hasMatched = true;
                    const val =  internalCheck(acceptType, property.type(), infer, strict, whenUnmatchHandler)
                    const result = errorHandler ? errorHandler(val, acceptType, property) : val;
                    if(!result) checkResult = false;
                }

                if(!hasMatched && !value.question){
                    return false;
                }
            }
            return checkResult;
        }
        return defaultResult
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
    return strict ? constraint(assingType) : is(assingType);
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