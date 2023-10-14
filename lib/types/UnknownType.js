const Type = require("./Type.js");
class UnknownType extends Type{
    constructor(){
        super("$UnknownType");
        this.isAnyType = true;
        this.isUnknownType = true;
    }
    check(){
        return true;
    }
    is(){
       return true;
    }
    toString(){
        return 'unknown';
    }
}
module.exports = UnknownType;