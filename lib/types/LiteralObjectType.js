const Utils = require("../core/Utils");
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

        if( type.isUnionType ){
            return type.elements.every( item=>this.constraint(item.type(), context, options) );
        }

        if( type.isAliasType ){
            return this.constraint(type.inherit.type(), context, options )
        }else if( type.isIntersectionType ){
            return this.constraint(type.left.type(), context, options) || this.constraint(type.right.type(), context, options);
        }

        const errorHandler = context.errorHandler || ( result=>result );
        const qp = this.questionProperties || {};
        const isObject = (type)=>{
            return (type.isLiteralObjectType || (type.isGenericType && type.hasConstraint)) && this.is(type, context, options);
        }
        const check = (type)=>{
            const properties = Array.from(this.properties);
            if( properties.length === 0 ){
                return true;
            }
            return properties.every( item=>{
                const [name,base] = item;
                const right = type.attribute( name );
                const acceptType = base.type();
                if( !right ){
                    const origin = this.target && this.target.attribute(name);
                    const question = (origin && origin.question) || qp[name];
                    return errorHandler(!!question, acceptType, right);
                }
                return errorHandler( acceptType.check(right, context), acceptType, right );
            });
        }

        if( isObject(type) ){
            return check(type);
        }else if( type.isIntersectionType ){
            return check(type);
        }

        type = Utils.getOriginType( type );
        if( type.isModule && type.id==='Object'){
            const properties = this.dynamicProperties;
            if( properties && properties.size > 0 ){
                for(let [key, value] of properties){
                    if( !value.question ){
                        return false;
                    }
                }
                return true;
            }else{
                return true 
            }
        }
        return false;
    }
    is( type, context, options={} ){
        if( !type || !(type instanceof Type) )return false;
        type = this.inferType(type, context);
        if( !this.isNeedCheckType(type) )return true;
        if( type.isUnionType ){
            return type.elements.every( item=>this.is(item.type(), context, options) );
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