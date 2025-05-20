const { extractMatchGenerics, extractGenericsFromType} = require("../core/Inference");
const MergeType = require("../core/MergeType");
const Type = require("./Type");
class ConditionType extends Type{
    constructor(target){
        super('$ConditionType');
        this.target = target;
        this.isConditionType=true;
    }
    getInferResult(context, records){
        const target = this.target;
        const constraint = target.extends.type();
        let argumentType = records && records.get(target.argument.type()) || context.infer(target.argument.type())
        if(argumentType){
            const result = constraint.is(argumentType, context);
            if(result && records){
                if(argumentType.isLiteralArrayType){
                    argumentType = MergeType.arrayToTuple(argumentType.elements);
                }
                let declareGenerics = [];
                let declareParams = [constraint];
                let assigmentArgs = [argumentType];
                let newRecords = new Map();
                if(constraint.isTupleType){
                    declareGenerics = constraint.elements.filter(item=>item.type().isInferGenericType);
                }else if(constraint.isClassGenericType){
                    declareGenerics = constraint.types.filter(item=>item.type().isInferGenericType)
                }else if(constraint.isFunctionType){
                    declareGenerics = constraint.params.filter(item=>item.type().isInferGenericType)
                    declareParams = constraint.params.slice(0);
                    assigmentArgs = argumentType.params.slice(0);
                    let returnType = constraint.getReturnedType();
                    if(returnType && returnType.isInferGenericType){
                        let assigmentReturnType = argumentType.getReturnedType();
                        if(assigmentReturnType){
                            extractMatchGenerics(newRecords, [returnType], [returnType], [assigmentReturnType])
                        }
                    }
                }else{
                    declareGenerics = extractGenericsFromType(constraint);
                }
                extractMatchGenerics(newRecords, declareGenerics, declareParams, assigmentArgs)
                newRecords.forEach((value, key)=>{
                    records.set(key, value)
                });
            }
            return result;
        }
        return false;
    }
    is(type, context){
        const target = this.target;
        const constraint = target.extends.type();
        return constraint.is(type, context);
    }
    toString(context, options={}){
        const target = this.target;
        const parts = [];
        const constraint = target.extends.type();
        parts.push(target.argument.value());
        parts.push(` extends ${constraint.toString(context, options)}`);
        return parts.join('');
    }
}
module.exports = ConditionType;