const Utils = require("../core/Utils");
const Namespace = require("../core/Namespace");
const Type = require("./Type");
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
        if( this.properties && Array.from( this.properties.values() ).some( item=>item.type().hasGenericType)){
            this._hasGenericType= true;
        }
        if( this.dynamicProperties && Array.from( this.dynamicProperties.values() ).some( item=>item.type().hasGenericType ) ){
            this._hasGenericType= true;
        }
        return this._hasGenericType;
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
        return new LiteralObjectType(this.inherit, this.target, properties, dynamicProperties);
    }
    attribute( property ){
        return this.properties.get(property);
    }
    dynamicAttribute(propertyType){
        const properties = this.dynamicProperties || (this.target && this.target.dynamicProperties);
        if( properties ){
            for(let [key, value] of properties){
                if( key.check( propertyType ) ){
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

        if( type.isAliasType ){
            return this.constraint(type.inherit.type(), context, options )
        }

        if( type.isUnionType ){
            return type.elements.every( item=>this.constraint(item.type(), context, options) );
        }

        const errorHandler = context.errorHandler || ( result=>result );
        const qp = this.questionProperties || {};
       
        if( !this.isBaseObject(type,context, options) ) {
            type = Utils.getOriginType(type);
            return type.isModule && type.id==='Object';
        }

        if(!(type.isLiteralObjectType || type.isIntersectionType || type.isGenericType))return false;

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
                const right = type.attribute( name );
                const acceptType = base.type();
                if( !right ){
                    const origin = this.target && this.target.attribute(name);
                    const question = (origin && origin.question) || qp[name];
                    return errorHandler(!!question, acceptType, right);
                }
                return errorHandler( acceptType.check(right, context, options), acceptType, right );
            });
        }

        if( !result ){
            result = this.checkDynamicProperties(type, context, options, errorHandler);
        }
        
        return result;
    }

    isBaseObject(type,context, options){
        if(type.isGenericType && type.hasConstraint)type = type.inherit.type();
        type = type.isLiteralObjectType ? type.inherit : type;
        if(type.isIntersectionType){
            return this.isBaseObject(type.left.type(),context, options) || this.isBaseObject(type.right.type(),context, options)
        }
        return this.inherit.is(type, context, options);
    }

    checkDynamicProperties(type, context, options={}, errorHandler=null){
        const properties = this.dynamicProperties;
        if( properties && properties.size > 0 ){

            let numberType = Namespace.globals.get('Number');
            const regexp = /^\d+$/
            const entries = type.attributes.entries();

            let checkResult = true;
            for(let [key, value] of properties){
                const matchType = key.type();
                const acceptType = value.init.type();
                let hasMatched = false;
                for(const [name, property] of entries){
                    if(matchType === numberType && !regexp.test(name) ){
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
        return true
    }

    is( type, context, options={} ){
        if( !type || !(type instanceof Type) )return false;
        type = this.inferType(type, context);
        if( !this.isNeedCheckType(type) )return true;
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
        const properties = Array.from(this.properties).map( item=>{
            const [name,base] = item;
            const type = base.type();
            const origin = this.target && this.target.attribute(name);
            if( origin && origin.computed ){
                return `[${name}]: ` + type.toString(context,options);
            }
            let question = origin && origin.question ? '?' : '';
            if( this.questionProperties && this.questionProperties[name] ){
                question = '?';
            }
            return `${name}${question}: ` + type.toString(context,options);
        });

        if( this.dynamicProperties ){
            this.dynamicProperties.forEach( (item,key)=>{
                properties.push( `[${key.type().toString()}]: ` + item.type().toString(context,options) )
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