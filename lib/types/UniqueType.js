const Type = require("./Type");
class UniqueType extends Type{
    constructor(origin){
        super("$UniqueType")
        this.isUniqueType = true;
        if(origin.isUniqueType){
            origin=origin.origin;
        }
        this.origin = origin;
    }
    is(type, context, options={}){
       return type === this;
    }
    toString(ctx, ...args){
        if( ctx ){
            return `unique ${this.origin.toString(ctx, ...args)}`
        }
        return this.origin.toString(ctx, ...args);
    }
}
module.exports = UniqueType;