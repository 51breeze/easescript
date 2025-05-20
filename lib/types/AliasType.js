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
            this.fullName = target;
        }else if( target && target.isStack ){
            this.typeName = target.value();
            this.fullName = this.typeName;
            if(target.namespace && target.namespace.isNamespace){
                this.fullName = target.namespace.getChain().concat( this.typeName ).join('.');
            }
        }
    }
    get id(){
        return this.toString();
    }

    get hasGenericType(){
        return this.inherit.hasGenericType;
    }

    getInferResult(context, records){
        const target = this.inherit.type()
        if(target){
            return target.getInferResult(context, records)
        }
        return null;
    }

    definition(ctx){ 
        if(Utils.isGlobalShortenType(this)){
            return null;
        }
        if(this.target && this.target.isStack){
            return this.target.definition(ctx);
        }
        return super.definition();
    }
    clone(inference){
        if( inference ){
            return new AliasType(this.inherit.clone(inference), this.target );
        }
        return this;
    }
    check( stack, context={},options={}){
        const type = stack && stack.type();
        if(!type)return false;
        if(!this.isNeedCheckType(type))return true;
        return this.inherit.type().check( stack, context, options);
    }
    is( type, context,options={}){
        if( !type || !(type instanceof Type) )return false;
        type = this.inferType(type, context);
        type = this.getWrapAssignType(type);
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
        let key = this.typeName || this.target.value();
        if(options.inbuild && this.fullName){
            key = this.fullName;
        }
        if(options.depth){
            return key;
        }
        if(!options.onlyTypeName && this.target && this.target.genericity && this.target.genericity.isGenericDeclaration){
            const declareGgenerics = this.target.genericity;
            if( declareGgenerics && declareGgenerics.elements.length > 0){
                const types = declareGgenerics.elements.map( item=>{
                    let decltype = item.type();
                    let _options = Object.create(options);
                    if(options.fetchDeclareGenericsDefaultValue){
                        if(decltype.assignType){
                            decltype = decltype.assignType.type();
                        }else{
                            return 'any';
                        }
                    }
                    return decltype.toString({}, _options);
                })
                return `${key}<${types.join(', ')}>`;
            }
        }
        return key;
    }
}
module.exports = AliasType;