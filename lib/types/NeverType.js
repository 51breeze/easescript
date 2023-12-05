const Type = require("./Type.js");
class NeverType extends Type{
    constructor(){
        super("$NeverType");
        this.isNeverType = true;
    }
    definition(){
        return {
            expre:`(type) never`
         };
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
        return 'never';
    }
}
module.exports = NeverType;