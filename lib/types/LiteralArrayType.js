const Type = require("./Type");
const Utils = require("../core/Utils");
class LiteralArrayType extends Type{
    constructor(inherit,target,elements=null){
        super("$LiteralArrayType",inherit)
        this.isLiteralArrayType = true;
        this.target = target;
        this.elements = elements || target.elements;
        this._hasGenericType = void 0;
    }

    get hasGenericType(){
        if( this._hasGenericType === void 0){
            this._hasGenericType = this.elements.some( type=>type.type().isGenericType );
        }
        return this._hasGenericType;
    }

    attribute( index ){
        if( this.target && !this.target.isTypeTupleDefinition ){
            return this.target.attribute(index);
        }
        index = Number(index)
        if(!isNaN(index)){
            return this.elements[index] || null;
        }
        return null;
    }
    dynamicAttribute( type, context=null ){
        if( this.target && !this.target.isTypeTupleDefinition ){
            return this.target && this.target.isArrayExpression ? this.target.dynamicAttribute( type, context ) : null;
        }
        return this.inherit.type().dynamicAttribute(type, context)
    }
    clone(inference, flag=false){
        if( !flag && (!inference || !this.hasGenericType) ){
            return this;
        }
        const elements = inference ? this.elements.map( item=> item.type().clone(inference) ) : this.elements.slice(0);
        return Utils.setMergedType(new LiteralArrayType(this.inherit, this.target, elements));
    }

    getElementTypes(){
        if( this._elementTypes ){
            return this._elementTypes;
        }
        const items = new Set();
        this.elements.forEach( item=>{
            items.add( item.type() );
        });
        return this._elementTypes = Array.from( items.values() );
    }

    is( type, context,options={}){
        if( !type || !(type instanceof Type) )return false;
        type = this.inferType(type, context);
        type = this.getWrapAssignType(type);
        if( !this.isNeedCheckType(type) )return true;
        if(type.isFunctionType || Utils.isScalar(type) || type.isLiteralObjectType)return false;
        if( type.isUnionType ){
            return type.elements.every( item=>this.is(item.type(), context, options) );
        }else if(type.isIntersectionType){
            return [type.left,type.right].some( item=>this.is(item.type(), context, options) );
        }
        if( type.isAliasType ){
            return this.is(type.inherit.type(), context, options )
        }
        if( type.isLiteralArrayType || type.isTupleType){
            const errorHandler = context && context.errorHandler || ( result=>result );
            let bases = this.getElementTypes().map( item=>item.type() );
            if( bases.length === 0 )return true;
            return type.elements.every( el=>{
                const elType = el.type();
                return errorHandler( bases.some( acceptType=>acceptType.is( elType, context, options) ), bases, el);
            });
        }
        return this.inherit.is(type, context, options);
    }
    toString(context,options={}){
        options = Object.assign({},options)
        context = this.pushToStringChain(context, options);
        const elements = this.elements.map( item=>{
            const type = item.type();
            if(type === this)return 'any';
            const ctx = type.isClassGenericType || Utils.isModule(type) ? null : context;
            return type.toString(ctx,options);
        }).join(", ");
        return `[${elements}]`;
    }
}
module.exports = LiteralArrayType;