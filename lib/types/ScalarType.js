const Type = require("./Type");
class ScalarType extends Type{
    constructor(inherit,target){
        super("$ScalarType",inherit)
        this.isScalarType = true;
        this.target = target;
    }
    get id(){
        return this.toString();
    }

    get hasGenericType(){
        return false
    }

    clone(){
        return this;
    }

    // check( stack, context={},options={}){
    //     const type = stack && stack.type();
    //     if( !type )return false;
    //     if( !this.isNeedCheckType(type) )return true;
    //     return this.inherit.type().check( stack, context, options);
    // }
    is( type, context,options={}){
        if( !type || !(type instanceof Type) )return false;
        type = type.isLiteralType ? type.inherit.type() : type;

        if( !this.isNeedCheckType(type) )return true;
        if( type.isUnionType ){
            return type.elements.every( item=>this.is( item.type(), context, options) );
        }

        if( this.toString()==="object" ){
            return !type.isScalarType && this.inherit.type().is( type, context, options);
        }

        type = type.isScalarType ? type.inherit.type() : type;
        return this.inherit.type().is(type, context,options);
    }

    toString(){
        return this.target.value();
    }
}
module.exports = ScalarType;