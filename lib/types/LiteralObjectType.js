const Utils = require("../core/Utils");
const Namespace = require("../core/Namespace");
const Type = require("./Type");
const privateKey = Symbol('privateKey');
function sorting(dataset){
    const priority = (item)=>{
        const type = item.type();
        if(!type || type.isGenericType)return 1;
        if(type.isLiteralType && type.isLiteralValueType){
            return 6
        }else if(type.isIntersectionType){
            return 5
        }else if(type.isClassGenericType ){
            const wrap = type.inherit.type();
            if( wrap && wrap.target && wrap.target.isDeclaratorTypeAlias && wrap.target.genericity ){
                return 4
            }
        }else if(type.isUnionType){
            return 2
        }
        return 3;
    };
    dataset.sort( (a, b)=>{
        if(a.params.length < b.params.length){
            return -1;
        }else if( a.params.length > b.params.length){
            return 1;
        }
        const a1 = a.params.reduce( (acc, item)=>{
            if(item.question)acc--;
            return acc + priority(item);
        }, 0);
        const b1= b.params.reduce( (acc, item)=>{
            if(item.question)acc--;
            return acc + priority(item);
        }, 0);
        if( a1===b1 )return 0;
        return a1 > b1 ? -1 : 1;
    });
    return dataset;
}

class LiteralObjectType extends Type{
    constructor(inherit,target,properties=null, dynamicProperties=null, questionProperties=null ){
        super("$LiteralObjectType",inherit)
        this.target = target;
        this.isLiteralObjectType = true;
        this.properties = properties || (target ? target.attributes : null);
        this.dynamicProperties = dynamicProperties || (target ? target.dynamicProperties : null);
        this.questionProperties = questionProperties;
        this._hasGenericType= void 0;
    }

    get hasGenericType(){
        if( this._hasGenericType !== void 0 ){
            return this._hasGenericType;
        }
        this._hasGenericType= false;
        if( this.properties && Array.from( this.properties.values() ).some( item=>item.type()?.hasGenericType)){
            this._hasGenericType= true;
        }
        if( this.dynamicProperties && Array.from( this.dynamicProperties.values() ).some( item=>item.type()?.hasGenericType ) ){
            this._hasGenericType= true;
        }
        return this._hasGenericType;
    }

    getDescriptor(name, filter, {isNew,isCall}={}, result=null){
        if(this.target && this.target.isTypeObjectDefinition){
            const descriptors = this.target.callDefinitions;
            if(!descriptors)return null;
            const dataset = descriptors.get(name);
            if( dataset ){
                if( !filter ){
                    return dataset[0] || result;
                }else{
                    if( !dataset[privateKey] ){
                        dataset[privateKey] = true;
                        sorting(dataset);
                    }
                    for(let i=0;i<dataset.length;i++){
                        const desc = dataset[i];
                        const value = filter(desc, result, i, dataset);
                        if( value ){
                            if(value === true){
                                return desc;
                            }else{
                                result = value;
                            }
                        }
                    }
                }
            }
        }
        return result;
    }

    clone(inference, flag=false){
        if( !flag && (!inference || !this.hasGenericType) ){
            return this;
        }
        const properties = new Map();
        let dynamicProperties = null;
        this.properties.forEach( (item,key)=>{
            if(inference){
                properties.set(key, item.type().clone( inference ) );
            }else{
                properties.set(key, item );
            }
        });
        const dynamics = this.dynamicProperties || (this.target && this.target.dynamicProperties);
        if( dynamics ){
            dynamicProperties = new Map();
            dynamics.forEach( (item,key)=>{
                dynamicProperties.set(key, item.type().clone( inference ));
            });
        }
        return Utils.setMergedType(new LiteralObjectType(this.inherit, this.target, properties, dynamicProperties));
    }
    attribute( property ){
        return this.properties.get(property);
    }
    dynamicAttribute(propertyType, context=null){
        const properties = this.dynamicProperties || (this.target && this.target.dynamicProperties);
        if( properties ){
            for(let [key, value] of properties){
                if( key.check( propertyType, context ) ){
                    return value;
                }
            }
        }
        return null;
    }
    get attributes(){
        return this.properties;
    }

    check( stack, context, options={}){
        return this.constraint( stack.type(), context, options );
    }

    constraint( type , context={}, options={}){
        if( !type || !(type instanceof Type) )return false;
        type = this.inferType(type, context);
        type = this.getWrapAssignType(type);
        if( !this.isNeedCheckType(type) )return true;
        if(type.isLiteralArrayType || type.isTupleType){
            return false;
        }
        if( type.isAliasType ){
            return this.constraint(type.inherit.type(), context, options )
        }

        if( type.isUnionType ){
            return type.elements.every( item=>this.constraint(item.type(), context, options) );
        }

        const errorHandler = context?.errorHandler || ( result=>result );
        const qp = this.questionProperties || {};
        const isInterface = Utils.isInterface(type)
        if( !isInterface && !this.isBaseObject(type,context, options) ) {
            type = Utils.getOriginType(type);
            return type.isModule && type.id==='Object';
        }

        if(!(type.isLiteralObjectType || type.isIntersectionType || type.isGenericType || isInterface))return false;
        if(type.isLiteralObjectType && type.properties.size===0){
            return true;
        }

        if(this.properties.size===0 && this.dynamicProperties && this.dynamicProperties.size === 0 ){
            return true;
        }

        let result = false;
        if(this.properties.size>0){
            const properties = Array.from(this.properties);
            result = properties.every( item=>{
                const [name,base] = item;
                const acceptType = base.type();
                let right = null;
                if(isInterface){
                    const result = type.getDescriptor(name, (desc)=>{
                        return acceptType.check(desc, context, options)
                    });
                    if(result){
                        return true
                    }
                }else{
                    right = type.attribute( name );
                }
                if(item===right)return true;
                if( !right ){
                    const origin = this.target && this.target.attribute(name);
                    const question = (origin && origin.question) || qp[name];
                    return errorHandler(!!question, acceptType, right);
                }
                return errorHandler( acceptType.check(right, context, options), acceptType, right );
            });
        }

        if(!result && type){
            result = this.checkDynamicProperties(type, context, options, errorHandler, !isInterface && this.properties.size==0);
        }
        
        return result;
    }

    isBaseObject(type,context, options){
        if(type.isGenericType && type.hasConstraint)type = type.inherit.type();
        type = type.isLiteralObjectType ? type.inherit : type;
        if(!type)return false;
        if(type.isIntersectionType){
            return this.isBaseObject(type.left.type(),context, options) || this.isBaseObject(type.right.type(),context, options)
        }
        return this.inherit.is(type, context, options);
    }

    checkDynamicProperties(type, context, options={}, errorHandler=null, defaultResult=true){
        const properties = this.dynamicProperties;
        const attributes = type && type.attributes;
        if( properties && properties.size > 0 && attributes instanceof Map){
            let numberType = Namespace.globals.get('number');
            const regexp = /^\d+$/
            const entries = attributes.entries();
            let checkResult = true;
            for(let [key, value] of properties){
                const matchType = key.type();
                if(!matchType)continue;
                const acceptType = value.init.type();
                let hasMatched = false;
                for(const [name, property] of entries){
                    if(matchType.is(numberType) && !regexp.test(name) ){
                        continue;
                    }
                    hasMatched = true;
                    const val = acceptType.check(property, context, options);
                    const result = errorHandler ? errorHandler(val, acceptType, property) : val;
                    if(!result) checkResult = false;
                }

                if(!hasMatched && !value.question){
                    return false;
                }
            }
            return checkResult;
        }
        return defaultResult
    }

    is( type, context, options={} ){
        if( !type || !(type instanceof Type) )return false;
        type = this.inferType(type, context);
        type = this.getWrapAssignType(type);
        if( !this.isNeedCheckType(type) )return true;
        if(type.isFunctionType || Utils.isScalar(type))return false;
        if(type.isLiteralArrayType || type.isTupleType){
            return false;
        }
        if( type.isAliasType ){
            return this.is(type.inherit.type(), context, options )
        }else if( type.isClassGenericType ){
            const inherit = type.inherit.type();
            if( inherit.isAliasType ){
                return this.is(inherit, context, options);
            }
        }else if( type.isIntersectionType ){
            return this.is(type.left.type(), context, options) || this.is(type.right.type(), context, options);
        }
        if( type.isUnionType ){
            return type.elements.every( item=>this.is(item.type(), context, options) );
        }
        type = type.isLiteralObjectType ? type.inherit : type;
        return this.inherit.is(type, context, options);
    }
    toString(context={},options={}){
        options = Object.assign({},options)
        context = this.pushToStringChain(context, options);
        let depth = 1
        if(!options.depth){
            options.depth = 1;
        }else{
            options.depth++;
            depth = options.depth;
        }
        if( options.inbuild){
            options.rawcode = false;
            options.onlyTypeName = true;
        }
        const properties = Array.from(this.properties).map( item=>{
            const [name,base] = item;
            const type = base.type();
            const ctx = type.isClassGenericType || Utils.isModule(type) ? null : context;
            const origin = this.target && this.target.attribute(name);
            if( origin && origin.computed ){
                return `[${name}]: ` + type.toString(ctx,options);
            }
            let question = origin && origin.question ? '?' : '';
            if( this.questionProperties && this.questionProperties[name] ){
                question = '?';
            }
            return `${name}${question}: ` + type.toString(ctx,options);
        });

        if(this.target && this.target.isTypeObjectDefinition){
            const descriptors = this.target.callDefinitions;
            if( descriptors ){
                descriptors.forEach( (items, key)=>{
                    const kind = key ==='#new#' ? 'new' : '';
                    items.forEach(item=>{
                        properties.unshift( kind+item.type().toString(context,options) );
                    })
                })
            }
        }

        if( this.dynamicProperties ){
            this.dynamicProperties.forEach( (item,key)=>{
                const kn = item.key ? item.key.value() : 'key';
                properties.push( `[${kn}:${key.type().toString()}]: ` + item.type().toString(context,options) )
            });
        }

        if( !properties.length ){
            return `{}`;
        }

        const newLine = `\r\n`;
        const indent = `\t`.repeat( depth );
        const end = depth > 1 ? `\t`.repeat( depth-1 ) : '';
        return `{${newLine}${indent}${properties.join(`,${newLine}${indent}`)}${newLine}${end}}`;
    }
}
module.exports = LiteralObjectType;