const UnionType = require("./UnionType"); 
const LiteralType = require("./LiteralType"); 
const Type = require("./Type.js");
const Namespace = require("../core/Namespace");
class KeyofType extends UnionType{
    constructor(target, referenceType){
        super([],target);
        this.id = '$KeyofType';
        this.isKeyofType = true;
        this.referenceType = referenceType;
        this.hasGenericType = !!referenceType.hasGenericType;
        this.elements = this.getTypeKeys(referenceType)
    }
    clone(inference){
        if( !inference || !this.hasGenericType ){
            return this;
        }
        const type =  this.referenceType.type().clone( inference );
        if( type !== this.referenceType ){
            return new KeyofType(this.target, type );
        }
        return this;
    }

    getTypeKeys( type ){
        type = type || this.referenceType;
        if( type.isGenericType ){
            return [];
        }
        const properties = new Set();
        if( type ){
            const push=(name,type)=>{
                properties.add( new LiteralType( Namespace.globals.get(type), this.target, name) );
            }
            switch(true){
                case type.isLiteralObjectType :
                case type.isEnumType :
                    type.attributes.forEach( (value,key)=>{
                        push(key, 'string');
                    });
                break;
                case type.isLiteralArrayType :
                case type.isTupleUnion :
                    type.elements.forEach( (value,key)=>{
                        push(key, 'number');
                    });
                break;
                case type.isIntersectionType : 
                case type.isModule :
                case type.isInstanceofType :
                    type.getTypeKeys().forEach( key=>{
                        push(key, 'string');
                    });
                break
            }
        }
        return Array.from( properties.values() );
    }
    check(stack, context={}, options={}){
        return this.is( stack && stack.type(), context, options );
    }
    is(type, context, options={}){
        if( !type || !(type instanceof Type) )return false;
        type = this.inferType(type, context);
        type = this.getWrapAssignType(type);
        options.toLiteralValue = true;
        if( type.isUnionType ){
            return type.elements.every( item=>this.is( item.type(), context, options) );
        }
        
        if( type.isAliasType ){
            return this.is(type.inherit.type(), context, options )
        }

        if( !this.isNeedCheckType(type) )return true;
        const infer = type=>{
            if( context && context.inference ){
                return context.inference(type);
            }
            return type;
        };
        const elements = this.getTypeKeys( infer( this.referenceType ) );
        if( !elements.length )return false; 
        if( type.isUnionType || type.isLiteralArrayType){
            return type.elements.every( item=>{
                const base = item.type();
                return elements.some( child=>{
                    return base.is(child.type(), context, options);
                });
            });
        }
        
        return elements.some( base=>base.type().is(type, context, options) );
    }
    toString(context={},options={}){
        options = Object.assign({},options)
        context = this.pushToStringChain(context, options);
        options.toLiteralValue = true;
        if( !options.complete ){
            let infer = (type)=>(typeof context.inference === 'function' ? context.inference(type) : type);
            let refType = infer(this.referenceType.type());
            if( refType.hasGenericType ){
                if( refType.isGenericType && refType.hasConstraint){
                    return `keyof ${refType.inherit.toString(context,options)}`;
                }
            }
            let elements = this.getTypeKeys( refType );
            if( !elements.length ){
                return 'keyof never';
            }
            let need = elements.length > 1;
            return elements.map( item=>{
                if( item.type().isFunctionType && need ){
                    return `(${item.type().toString(context,options)})`
                }
                return item.type().toString(context,options) 
            }).join(' | ');
        }
        options = Object.create(options);
        options.onlyTypeName = true
        return `keyof ${this.referenceType.type().toString(context,options)}`;
    }
}
module.exports = KeyofType;