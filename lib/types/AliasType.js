const Utils = require("../core/Utils");
const Type = require("./Type");
class AliasType extends Type{
    constructor(inherit,target){
        if( inherit && inherit.isAliasType ){
            inherit = inherit.inherit;
        }
        super("$AliasType",inherit)
        this.isAliasType = true;
        this.target = target;
        if( typeof target ==='string' ){
            this.typeName = target;
        }else if( target && target.isStack ){
            this.typeName = target.value();
        }
    }
    get id(){
        return this.toString();
    }

    get hasGenericType(){
        return this.inherit.hasGenericType;
    }

    definition(ctx){ 
        if(this.target && this.target.isStack){
            return this.target.definition(ctx);
        }
        return super.definition();
    }
    clone(inference){
        if( inference ){
            return new AliasType( inference(this.inherit), this.target );
        }
        return this;
    }
    check( stack, context={},options={}){
        const type = stack && stack.type();
        if( !type )return false;
        if( !this.isNeedCheckType(type) )return true;
        return this.inherit.type().check( stack, context, options);
    }
    is( type, context,options={}){
        if( !type || !(type instanceof Type) )return false;
        if( !this.isNeedCheckType(type) )return true;
        if( type.isUnionType ){
            return type.elements.every( item=>this.is( item.type(), context, options) );
        }
        if( this.toString()==="object" ){
            return !Utils.isScalar(type) && this.inherit.type().is( type, context, options);
        }
        return this.inherit.type().is( type, context,options);
    }
    toString(context, options={}){
        const key = this.typeName || this.target.value();
        if(!options.onlyTypeName && this.target && this.target.genericity && this.target.genericity.isGenericDeclaration){
            const declareGgenerics = this.target.genericity;
            if( declareGgenerics && declareGgenerics.elements.length > 0){
                const types = declareGgenerics.elements.map( item=>item.type().toString(context, options) )
                return `${key}<${types.join(', ')}>`;
            }
        }
        return key;
    }
}
module.exports = AliasType;