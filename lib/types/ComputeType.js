const Namespace = require("../core/Namespace");
const Utils = require("../core/Utils");
const Type = require("./Type");
const UnionType = require("./UnionType");
const {extractWrapGenericValue} = require("../core/Inference");
class ComputeType extends Type{
    constructor(target,object,property,keyName){
        super("$ComputeType")
        this.isComputeType = true;
        this.isAnyType = true;
        this.target = target;
        this.object = object;
        this.property = property;
        this.originObject = object;
        this.originProperty = property;
        this.keyName = keyName;
        this.computed = true;
    }

    get hasGenericType(){
        return !!(this.object.type().hasGenericType || this.property.type().hasGenericType);
    }

    clone(inference){
        if( !inference || !this.hasGenericType ){
            return this;
        }
        const target = this.getComputeType();
        if(target !== this ){
            return target.clone( inference );
        }

        let object = this.object.type().clone(inference);
        let property = this.property.type().clone(inference);
        if( property.isGenericType && property.hasConstraint ){
            const inherit = property.inherit.clone(inference);
            if( !inherit.hasGenericType ){
                property = inherit;
            }
        }

        if( object.hasGenericType || property.hasGenericType ){
            return this;
        }
        let result = new ComputeType(this.target,object,property,this.keyName);
        result.originObject = this.object;
        result.originProperty = this.property;
        return result;
    }

    isPropertyExists(keyStack){
        const context = this.target && this.target.isStack ? this.target.getContext() : null;
        const inference = context && context.inference;
        let object = this.object.type()
        let property = this.property.type()
        if( inference ){
            object = object.hasGenericType ? inference( object ) : object;
            property = property.hasGenericType ? inference( property ) : property;
        }
        return !!this.getComputeValue( object, property, keyStack || this.property);
    }

    getComputeValue(object, property, keyStack){
        const getProperty=(object, propName, propertyType)=>{
            let result = null;
            if( object.isInstanceofType ){
                if( propName ){
                    result = object.inherit.getDescriptor(propName, (desc, prev)=>{
                        if( (desc.isPropertyDefinition || desc.isMethodGetterDefinition) && Utils.isModifierPublic(desc) ){
                            return true;
                        }
                        return prev || desc;
                    });
                }
                if( !result ){
                    result = object.inherit.dynamicAttribute( propertyType );
                }
                if( result && result.isStack && !Utils.isModifierPublic(result) ){
                    return null
                }
            }else if( object.isLiteralObjectType ){
                result = (propName && object.attribute( propName )) || object.dynamicAttribute( propertyType );
            }else if( object.isLiteralArrayType || object.isTupleType ){
                const propIndex = propName === null ? -1 : parseInt( propName );
                if( propIndex >= 0 && propIndex < object.elements.length  ){
                    result = object.elements[ propName ];
                }
                if(!result){
                    result = object.dynamicAttribute( propertyType );
                }
            }else{
                object = Utils.getOriginType( object );
                if( object.isInterface && object.isModule ){
                    if( propName ){
                        result = object.getDescriptor(propName, (desc, prev)=>{
                            if( (desc.isPropertyDefinition || desc.isMethodGetterDefinition) && Utils.isModifierPublic(desc) ){
                                return true;
                            }
                            return prev || desc;
                        });
                    }
                    if( !result ){
                        result = object.dynamicAttribute( propertyType );
                    }
                }
            }
            return result ? result.type() : null;
        }
        const getProperties = (object,property)=>{
            if( property.isUnionType || property.isTupleType || property.isLiteralArrayType){
                const reduce = (accumulator,item) => (item.isUnionType || item.isTupleType ? item.elements.reduce(reduce, accumulator) : accumulator.concat(item.type()) );
                const keys = property.elements.reduce( reduce, []).filter( item=>item.isLiteralType );
                const values = keys.map( item=>{
                    return getProperty(object, item.value, item);
                }).filter( item=>!!item );
                if( values.length ){
                    if( values.length === 1 )return values[0];
                    return new UnionType( values, this.target);
                }
            }else{
                return getProperty(object, property.isLiteralType ? property.value : null, property);
            }
            return null;
        };
        const defaultType = Namespace.globals.get('any');
        const getDesc = (name,keyType)=>{
            if( object.isLiteralArrayType || object.isLiteralObjectType || (object.isGenericType && object.hasConstraint) || object.isTupleType ||
                object.isEnumType || object.isIntersectionType || object.isInstanceofType ){
                const desc = name ? object.attribute( name ) : null;
                if( desc ){
                    return desc.type();
                }
                else if( object.isLiteralObjectType || object.isLiteralArrayType || object.isTupleType ){
                    return getProperties(object,keyType) || defaultType;
                }
                else if( object.isInstanceofType ){
                    return getProperties(object,keyType) ||  defaultType;
                }
            }else if(name){
                return getProperty(object, name, keyType) ||  defaultType;
            }else{
                return getProperties(object, keyType) ||  defaultType;
            }
        }
        let key = (property.isUnionType || property.isLiteralArrayType) && keyStack ? property.elements.find( ele=>ele.type().check( keyStack, {}, {toLiteralValue:true} ) ) : property;
        if(key)key = key.type();
        return key && key.isLiteralType ? getDesc( key.value, key ) : getDesc( null, key || property );
    }

    getComputeType(keyStack, context){
        const object = this.inferType(this.object.type(), context);
        const property = this.inferType(this.property.type(), context);
        if(object && object.isThisType){
            return this;
        }
        if(object && property && !(object.isGenericType || property.isGenericType) ){
            const result = this.getComputeValue(object, property, keyStack);
            return result ? result : Namespace.globals.get('any');
        }
        return this;
    }

    getComputeResult(keyStack, context){
        const object = this.inferType(this.object.type(), context);
        const property = this.inferType(this.property.type(), context);
        if(object && object.isThisType){
            return this;
        }
        if(object && property && !(object.isGenericType || property.isGenericType) ){
            const result = this.getComputeValue(object, property, keyStack);
            return result ? result : Namespace.globals.get('any');
        }
        return Namespace.globals.get('any');
    }

    getResult(keyStack){
        const object = this.object.type();
        const property = this.property.type();
        if( !(object.isGenericType || property.isGenericType) ){
            const result = this.getComputeValue(object, property, keyStack);
            if(result)return result
        }
        return Namespace.globals.get('any');
    }


    getInferResult(context, records=new Map()){
        const inference = (type)=>{
            type = type.type();
            const res = records && records.get(type) || context.infer(type)
            return res || type;
        }
        let object = inference(this.object.type());
        let property = inference(this.property.type());
        if(property.isConditionalExpressionType){
            if(!records.count){
                records.count = 1;
            }
            records.count++;
            property = property.getInferResult(context, records)
            let result = this.getComputeValue(object, property);
            if(result && result.isConditionalExpressionType){
                result = result.getInferResult(context, records);
            }
            result = result.clone(inference)
            if(records.count<100 && Utils.getOriginType(result) === this){
                const _result = result.getInferResult(context, records);
                if(_result){
                    result = _result
                }
            }
            return result;
        }
        if(object.isClassGenericType){
            const newRecords = extractWrapGenericValue(object);
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
        let result = this.getComputeResult(null, context)
        result = inference(result);
        if(result && result !== this){
            let res = result.getInferResult(context, records)
            if(res){
                return res;
            }
        }
        return result
    }

    definition(){
        return {
            expre:`(type) ${this.toString()}`
        };
    }
    
    is(type, context={}, options={}){
        if( !type || !(type instanceof Type) )return false;
        type = this.inferType(type, context);
        type = this.getWrapAssignType(type);
        if( type.isUnionType ){
            return type.elements.every( item=>this.is( item.type(), context, options) );
        }
        let object = this.inferType( this.object.type(), context );
        let property = this.inferType( this.property.type(), context );
        if( !(object.isGenericType || property.isGenericType) ){
            return this.inferType( this.getComputeValue(object, property), context ).is(type, context, options);
        }
        return !(type.isTupleType || type.isLiteralArrayType);
    }

    toString(context,options={}){
        options = Object.assign({},options)
        context = this.pushToStringChain(context, options);
        const result = this.getComputeType(null, context)
        if( result !== this ){
            return result.toString(context,options);
        }
        let object = this.object.type();
        let property = this.property.type();
        if( !(object.isGenericType || property.isGenericType) ){
            if( object.isThisType ){
                let labels = '';
                if( property.isLiteralArrayType ){
                    labels = property.elements.map( item=>{
                        return item.type().toString(context, {toLiteralValue:true})
                    }).join(' | ')
                }else{
                    labels = property.toString(context, Object.assign(options,{toLiteralValue:true}));
                }
                return `${object.toString()}[${labels}]`;
            }else{
                return this.getComputeValue(object, property).toString(context,options);
            }
        }
        return `${this.originObject.type().toString(context,options)}[${this.originProperty.type().toString(context,options)}]`;
    }
}
module.exports = ComputeType;