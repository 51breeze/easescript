const Type = require("./Type.js");
class AnyType extends Type{
    constructor(){
        super("$any");
        this.isAnyType = true;
    }
    check(){
        return true;
    }
    definition(){
        return {
            expre:`(type) any`
         };
    }
    is(){
       return true;
    }
    toString(context, options={}){
        options.hasAnyType = true;
        return 'any';
    }
}
module.exports = AnyType;