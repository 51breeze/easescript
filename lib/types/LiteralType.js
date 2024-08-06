const Type = require("./Type");
class LiteralType extends Type{
    constructor(inherit,target, value, compareLiteralValue=false){
        super("$LiteralType",inherit)
        this.isLiteralType = true;
        this.target = target;
        this.value = value;
        this.compareLiteralValue = compareLiteralValue;
    }
    is(type, context,  options={}){
        if( !type || !(type instanceof Type) )return false;
        type = this.inferType(type, context);
        type = this.getWrapAssignType(type);
        if( !this.isNeedCheckType(type) )return true;
        if( type.isAliasType ){
            return this.is(type.inherit.type(), context, options )
        }
        if( type.isUnionType ){
            return type.elements.every( item=>this.is(item.type(), context, options) );
        }
        if( this.isLiteralValueType || options.toLiteralValue ){
            return this.inherit.is(type, context) && type.isLiteralType && this.value === type.value;
        }
        return this.inherit.is( type, context );
    }

    get isLiteralValueType(){
        return this.target && (this.target.isTypeDefinition || this.target.isTypeKeyofDefinition) || this.compareLiteralValue;
    }

    toString(context, options={}){
        if( this.isLiteralValueType || options.toLiteralValue){
            if(typeof this.value ==="string"){
                const str = this.value.replace(/[\'\"]/g,'');
                return `"${str}"`
            }else if( this.value !== void 0 ){
                return this.value;
            }
        }
        return this.inherit && this.inherit.toString(context, options);
    }
}
module.exports = LiteralType;