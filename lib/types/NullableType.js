const Namespace = require("../core/Namespace");
const Type = require("./Type");
class NullableType extends Type{
    constructor(inherit){
        super("$NullableType",inherit)
        this.isNullableType = true;
    }
    is( type, context, options ){
        if( !type || !(type instanceof Type) )return false;
        type = this.inferType(type, context);
        type = this.getWrapAssignType(type);
        if( !this.isNeedCheckType(type) )return true;
        if( type.isUnionType ){
            return type.elements.every( item=>this.is(item.type(), context, options) );
        }
        if( type.isAliasType ){
            return this.is(type.inherit.type(), context, options )
        }
        if( type.isInstanceofType && type.generics && type.generics.length === 1 ){
            const PromiseModule = Namespace.globals.get('Promise');
            const inheritModule = type.inherit;
            if( PromiseModule && inheritModule && PromiseModule.is( inheritModule.type(), context, options ) ){
                return this.is(type.generics[0].type(), context, options);
            }
        }
        return !!type.isNullableType;
    }
    toString(){
        return "null";
    }
}
module.exports = NullableType;