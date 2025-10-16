const MergeType = require("../core/MergeType");
const Utils = require("../core/Utils");
const Type = require("./Type");
class ConditionalExpressionType extends Type{
    #_types = null;
    constructor(target){
        super('$ConditionalExpressionType');
        this.target = target;
        this.isConditionalExpressionType=true;
    }

    getInferResult(context, records=new Map(), flag=false){
        const target = this.target;
        const condition = target.condition.type().getInferResult(context, records);
        let result = null;
        if(condition){
            result = target.consequent.type();
        }else{
            if(flag)return null;
            result = target.alternate.type();
        }
        if(result.isInferGenericType){
            return result.getInferResult(context, records)
        }else if(result.isConditionalExpressionType){
            return result.getInferResult(context, records)
        }
        const inference = (type)=>{
            type = type.type();
            const res = records && records.get(type) || context.infer(type)
            return res || type;
        }
        return result.hasGenericType ? result.clone(inference) : result;
    }

    extracts(){
        const target = this.target;
        const consequent = target.consequent.type();
        const alternate = target.alternate.type();
        const items = []
        if(consequent.isConditionalExpressionType){
            items.push(...consequent.extracts())
        }else{
            items.push(consequent)
        }
        if(alternate.isConditionalExpressionType){
            items.push(...alternate.extracts())
        }else{
            items.push(alternate)
        }
        return items;
    }

    toUnionType(){
        const exists = this.#_types;
        if(exists)return exists;
        const items = this.extracts();
        return this.#_types = MergeType.arrayToUnion(items);
    }

    is(type, context){
        if(Utils.isContext(context)){
            const result = this.getInferResult(context, new Map(), true);
            if(result){
                return result.is(type, context)
            }
        }
        return this.toUnionType().is(type, context)
    }

    toString(context, options={}){
        if(Utils.isContext(context)){
            const result = this.getInferResult(context, new Map(), true);
            if(result){
                return result.toString(context, options)
            }
        }
        return this.toUnionType().toString(context, options)
    }
}
module.exports = ConditionalExpressionType;