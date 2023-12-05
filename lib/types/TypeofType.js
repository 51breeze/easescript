const Type = require("./Type");
class TypeofType extends Type{
    constructor(origin){
        super("$TypeofType",)
        this.isTypeofType = true;
        this.origin = origin;
        const id = origin.id.slice(1);
        const key = 'is'+id.slice(0,1).toUpperCase()+id.slice(1);
        this[key] = origin[key];
    }
    get hasGenericType(){
        return this.origin.hasGenericType;
    }
    definition(ctx){ 
        return this.origin.definition(ctx);
    }
    clone(inference){
        return this.origin.clone(inference);
    }
    constraint(...args){
        return this.origin.constraint(...args);
    }
    check(...args){
        return this.origin.check(...args);
    }
    is(...args){
        return this.origin.is(...args);
    }
    toString(ctx, ...args){
        if( ctx ){
            return `typeof ${this.origin.toString(ctx, ...args)}`
        }
        return this.origin.toString(ctx, ...args);
    }
}
module.exports = TypeofType;