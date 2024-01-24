const Type = require("./Type");
class CircularType extends Type{
    constructor(inherit,target,typeName){
        super("$CircularType",inherit)
        this.isCircularType = true;
        this.target = target;
        this.typeName = typeName;
    }
    get id(){
        return this.typeName;
    }

    get hasGenericType(){
        return this.inherit.hasGenericType;
    }

    definition(ctx){ 
        return this.inherit.definition(ctx);
    }
    clone(inference){
        if( inference ){
            return new CircularType( inference(this.inherit), this.target, this.typeName);
        }
        return this;
    }
    check( stack, context={},options={}){
        return this.inherit.check( stack, context, options);
    }
    is(type, context,options={}){
        const acceptType = this.inherit;
        if(acceptType.isLiteralObjectType){
            return acceptType.constraint(type, context, options);
        }
        return acceptType.is(type, context,options);
    }
    toString(context, options={}){
        return this.typeName;
    }
}
module.exports = CircularType;