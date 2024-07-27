const Type = require("./Type");
class TypeofType extends Type{
    constructor(origin, displayName=null){
        super("$TypeofType",)
        this.isTypeofType = true;
        if(origin.isTypeofType){
            origin=origin.origin;
        }
        this.origin = origin;
        this.displayName = displayName;
    }
    get hasGenericType(){
        return this.origin.hasGenericType;
    }
    definition(ctx){ 
        return {
            expre:`typeof ${this.displayName || this.origin.toString(ctx)}`
        };
    }
    get attributes(){
        return this.origin.properties;
    }

    attribute( property ){
        return this.origin.attribute(property);
    }

    dynamicAttribute(propertyType, context=null){
        return this.origin.dynamicAttribute(propertyType, context);
    }

    checkDynamicProperties(type, context, options={}, errorHandler=null){
        return this.origin.checkDynamicProperties(type, context, options={}, errorHandler);
    }

    clone(inference){
        return this.origin.clone(inference);
    }
    constraint(stack, context, options={}){
        return this.origin.constraint(stack, context, options);
    }
    check(stack, context, options={}){
        return this.origin.check(stack, context, options);
    }
    is(type, context, options={}){
        if(type && type.isTypeofType)type = type.origin;
        return this.origin.is(type, context, options);
    }
    toString(ctx, options={}){
        ctx = this.pushToStringChain(ctx, options);
        if(options.onlyTypeName && this.displayName){
            return `typeof ${this.displayName}`
        }
        return this.origin.toString(ctx, options);
    }
}
module.exports = TypeofType;