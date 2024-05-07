const Type = require("./Type.js");
class UndefinedType extends Type{
    constructor(){
        super("undefined");
        this.isUndefinedType = true;
    }
    definition(){
        return null
    }
    is(type,context={}, options={}){
        if( !type || !(type instanceof Type) )return false;
        type = this.getWrapAssignType(type);
        if( !this.isNeedCheckType(type) )return true;
        if( type.isUnionType ){
            return type.elements.every( item=>this.is(item.type(), context, options) );
        }
        return type === this;
    }
    toString(){
        return 'undefined';
    }
}
module.exports = UndefinedType;