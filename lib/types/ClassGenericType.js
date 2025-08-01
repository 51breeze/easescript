const Namespace = require("../core/Namespace");
const {extractWrapGenericValue} = require("../core/Inference");
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

    getInferResult(context, records){
        const target = this.inherit.type()
        if(records){
            const newRecords = extractWrapGenericValue(this);
            if(newRecords){
                newRecords.forEach((value, key)=>{
                    const res = value.getInferResult(context, records)
                    if(res){
                        value = res;
                    }
                    records.set(key, value)
                })
            }
        }
        if(target && target.isAliasType){
            return target.getInferResult(context, records)
        }
        return null;
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

    getDeclareGenerics(){
        if(this.target && this.target.isTypeGenericDefinition){
            return this.target.getDeclareGenerics()
        }
        return [];
    }

    check(stack, context,options={}){
        if(!stack)return false;
        const inherit = this.inherit.type();
        const isWrap = inherit.isAliasType;
        const type = this.inferType(stack.type(), context);
        if(!type.isClassGenericType){
            if(this.isClassType && type.isInstanceofType)return false;
            if(!this.isClassType && inherit.check(stack, context, options)){
                return true;
            }
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
        if(!(type.isClassGenericType || type.isTupleType || type.isLiteralArrayType || (type.isInstanceofType && !type.isThisType))){
            if(this.isClassType && type.isInstanceofType)return false;
            if(!this.isClassType && inherit.is(type, context, options)){
                return true;
            }
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
            let baseType = this.inferType(type.inherit.type(), context)
            
            if(type.isInstanceofType && !type.isThisType && type.target && type.target.isNewExpression){
                if(baseType.isClassGenericType && baseType.isClassType){
                    baseType = baseType.types[0].type()
                    type = baseType;
                    baseType = type.inherit.type();
                }
            }

            if( !inherit.is(baseType, context, options) )return false

            let accepts = this.types;
            if(type.isTupleType || type.isLiteralArrayType){
                return accepts.every( (accept)=>{
                    accept = accept.type()
                    if(accept.isGenericType)return true;
                    return type.elements.some(item=>accept.is(item.type(), context))
                });
            }

            let assigments = type.isInstanceofType ? type.generics : type.types;
            let [_, declares=[]] = this.getDeclareGenerics();

            const result = accepts.every( (accept,index)=>{
                accept = accept.type();
                if(accept.isGenericType)return true;
                const assign  = assigments[index];
                const declared = declares[index];
                if( assign ){
                    return accept.is( assign.type(), context , options);
                }else if(accept.isNullableType || accept.isVoidType){
                    return true;
                }
                if(declared && declared.isGenericTypeAssignmentDeclaration){
                    return true;
                }
                if(accept.isAnyType)return true;
                return false;
            });
            
            return result;
        }else{
            if(!type.isClassType)return false;
            return this.types.every( (base,index)=>{
                const assign = type.types[index];
                const acceptType = base.type();
                if(acceptType.isAnyType || (!assign && (acceptType.isNullableType || acceptType.isVoidType)))return true;
                return assign ? acceptType.is(assign.type(), context, options) : false;
            });
        }
    }
    toString(context={}, options={}){
        options = Object.assign({},options)
        context = this.pushToStringChain(context, options);
        const types = this.types.map( type=>{
            const _options = options.inbuild ? Object.assign({},options,{rawcode:false,onlyTypeName:true}) : Object.create(options);
            if( type.isGenericType && type.hasConstraint && type.inherit.type() === this){
                return type.target ? type.target.value() : 'any';
            }
            return type.toString(context,_options)
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
        return this.extends[0].toString(context,Object.create(options));
    }

}
module.exports = ClassGenericType;