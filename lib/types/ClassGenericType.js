const Namespace = require("../core/Namespace");
const Type = require("./Type");
class ClassGenericType extends Type{
    constructor(types, inherit, isClass, target ){
        super('$ClassGenericType', inherit );
        this.isClassGenericType=true;
        this.isClassType = !!isClass;
        this.elements = types;
        this.target = target;
        this.isThisType = !!(target && target.isThisType);
        this._relatedTypes = null;
    }
    
    get types(){
        const t = this._types;
        if(t)return t;
        return this._types = this.elements.map( el=>el.type() );
    }

    get hasGenericType(){
        return this.types.some(type=>{
            return type && !!(type.isGenericType || type.hasGenericType);
        }) || this.inherit.hasGenericType;
    }

    clone(inference){
        if( !inference ){
            return this;
        }
        const types = this.types.map( type=>{
            return type.clone( inference )
        });
        const result = new ClassGenericType(types, this.inherit, this.isClassType, this.target);
        result._relatedTypes = this._relatedTypes;
        return result;
    }

    getWrapCheckerType(wrapType){
        if( this.elements.length === 1 ){
            const declareGenerics = wrapType.target.genericity;
            const has = declareGenerics ? declareGenerics.elements.some( item=>item.type() === wrapType.inherit.type() ) : false;
            if( has ){
                return this.elements[0].type()
            }
        }
        return wrapType.inherit.type()
    }

    check(stack, context,options={}){
        if(!stack)return false;
        const inherit = this.inherit.type();
        const isWrap = inherit.isAliasType;
        const type = stack.type();
        if(!type.isClassGenericType){
            if(this.isClassType && type.isInstanceofType)return false;
            if(isWrap){
                return this.getWrapCheckerType(inherit).check(stack, context, options);
            }
            if( this.hasDynamicAttribute(inherit, context) ){
                return Namespace.globals.get('object').is(type , context, options);
            }
            if(type.isUnionType || type.isIntersectionType){
                return this.is(type, context, options);
            }
            return this.isClassType ? this.types[0].is(type,context) : inherit.check(stack, context,options);
        }
        return this.is(type, context, options);
    }

    hasDynamicAttribute(object, context=null){
        if(object && object.isModule && (object.isInterface || object.isClass)){
            return !!object.dynamicAttribute(Namespace.globals.get('string'), context)
        }
        return false;
    }

    is( type, context, options={}){
        if( !type || !(type instanceof Type) )return false;
        type = this.inferType(type, context);
        if( !this.isNeedCheckType(type) )return true;
        if( type.isUnionType ){
            return type.elements.every( item=>this.is(item.type(), context, options) );
        }else if(type.isIntersectionType){
            return [type.left,type.right].some( item=>this.is(item.type(), context, options) );
        }
        if(this.isClassType && (type.isInstanceofType || !(type.isClassType && type.isClassGenericType) || type.isInterface)){
            return false;
        }
        const inherit = this.inherit.type();
        const isWrap = inherit.isAliasType;
        if(!(type.isClassGenericType || (type.isInstanceofType && !type.isThisType))){
            if(this.isClassType && type.isInstanceofType)return false;
            if(isWrap){
                return this.getWrapCheckerType(inherit).is(type, context, options);
            }
            if( this.hasDynamicAttribute(inherit, context) ){
                return Namespace.globals.get('object').is( type, context, options );
            }
            return this.isClassType ? this.types[0].is(type,context,options) : inherit.is(type, context,options);
        }
        if( !this.isClassType ){
            if(type.isClassType)return false;
            const baseType = type.inherit.type();
            if( !inherit.is(baseType, context, options) )return false
            let accepts = this.types;
            let assigments = type.isInstanceofType ? type.generics : type.types;
            const result = accepts.every( (accept,index)=>{
                const assign  = assigments[index];
                if( assign ){
                    return accept.type().is( assign.type(), context , options);
                }
                return false;
            });
            return result;
        }else{
            if(!type.isClassType)return false;
            return this.types.every( (base,index)=>{
                const assign = type.types[index];
                return assign ? base.type().is(assign.type(), context, options) : false;
            });
        }
    }
    toString(context={}, options={}){
        options = Object.assign({},options)
        context = this.pushToStringChain(context, options);
        const tooptions = options.inbuild ? Object.assign({},options,{rawcode:false,onlyTypeName:true}) : options;
        const types = this.types.map( type=>{
            if( type.isGenericType && type.hasConstraint && type.inherit.type() === this){
                return type.target ? type.target.value() : 'any';
            }
            return type.toString(context,tooptions)
        });
        if( this.target ){
            if( this.isClassType ){
                return `${this.target.value()}<${types.join(", ")}>`;
            }
            if( this.inherit.isModule ){
                return `${this.inherit.getName()}<${types.join(", ")}>`;
            }else{
                return `${this.inherit.toString(context, Object.assign({},options,{onlyTypeName:true}) )}<${types.join(", ")}>`;
            }
        }
        return this.extends[0].toString(context,options);
    }

}
module.exports = ClassGenericType;