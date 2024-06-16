const Type = require("./Type");
class PredicateType extends Type{
    constructor(inherit, value, argument){
        super("$PredicateType", inherit)
        this.isPredicateType = true;
        this.value = value;
        this.argument = argument;
    }
    inferType(){
        return this.value.type();
    }
    is(type, context, options={}){
       return this.inherit.is(type, context, options)
    }
    toString(ctx, options={}){
        const parent = options.chain && options.chain[options.chain.length-1];
        if(parent && (parent==='function' || parent.isFunctionType)){
            const argument = this.argument.raw();
            const value = this.value.raw();
            return `${argument} is ${value}`
        }else{
            ctx = this.pushToStringChain(ctx, options);
            return this.inherit.toString(ctx, options);
        }
    }
}
module.exports = PredicateType;