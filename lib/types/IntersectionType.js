const Type = require("./Type"); 
const Utils = require("../core/Utils"); 
class IntersectionType extends Type{
    constructor( target ,left, right){
        super("Intersection");
        this.isIntersectionType = true;
        this.target = target;
        this.left = left;
        this.right = right;
        this.hasGenericType = left && left.hasGenericType || right && right.hasGenericType;
    }
    clone(inference){
        if( !inference || !this.hasGenericType ){
            return this;
        }
        return new IntersectionType(this.target, this.left.clone(inference), this.right.clone(inference) );
    }

    getProperty(object, property){
        if(!object)return null
        if(object.isAliasType){
            return this.getProperty(object.inherit.type(), property)
        }
        if( object.isLiteralArrayType || object.isLiteralObjectType || object.isGenericType || object.isEnumType || object.isIntersectionType){
            return object.attribute( property )
        }else if( object.isModule ){
            const prop = object.getMember(property, 'get');
            if( prop && Utils.isModifierPublic(prop) ){
                return prop;
            }
        }
        return null;
    }

    attribute( property ){
        return this.getProperty(this.left.type(), property) || this.getProperty(this.right.type(), property);
    }

    get attributes(){
        return this.getProperties();
    }

    getProperties(datamap=null){
        datamap = datamap || new Map();
        const make=(type)=>{
            if(type.isAliasType){
                make(type.inherit.type())
            }else if(type.isLiteralArrayType){
                type.elements.forEach((value,key)=>{
                    datamap.set(key, value);
                })
            }
            else if(type.isLiteralObjectType || type.isEnumType || type.isIntersectionType){
                type.attributes.forEach( (value,key)=>{
                    datamap.set( key, value );
                });
            }else if( type.isModule ){
                type.getProperties( datamap );
            }
        }
        make(this.left.type());
        make(this.right.type());
        return datamap;
    }

    getTypeKeys(){
        return Array.from( this.getProperties().keys() );
    }

    check(stack, context, options={}){
        const left = this.left;
        const right = this.right;
        const type = Utils.getShortType(this.inferType(stack.type(),context));
        if(type && type.isIntersectionType){
            const items = [type.left.type(), type.right.type()];
            return [left.type(), right.type()].every( acceptType=>{
                return items.some( type=>acceptType.check(type, context, options) )
            })
        }
        return left.type().check(stack, context, options) && right.type().check(stack, context, options);
    }

    checkType(acceptType, assignment, context, options){
        acceptType = Utils.getShortType(acceptType)
        if(acceptType.isLiteralObjectType){
            return acceptType.constraint(assignment, context, options)
        }
        return acceptType.is(assignment, context, options)
    }

    is(type, context,options={}){
        if( !type || !(type instanceof Type) )return false;
        type = this.inferType(type, context);
        type = this.getWrapAssignType(type);
        if( !this.isNeedCheckType(type) )return true;
        if( type.isAliasType ){
            return this.is(type.inherit.type(), context, options )
        }
        const left = this.left;
        const right = this.right;
        if(type && type.isIntersectionType){
            const items = [type.left.type(), type.right.type()];
            return [left.type(), right.type()].every( acceptType=>{
                return items.some( type=>acceptType.is(type, context, options) )
            })
        }
        return this.checkType(left.type(),type, context,options) && this.checkType(right.type(), type, context,options);
    }
    toString(context,options={}){
        options = Object.assign({},options)
        context = this.pushToStringChain(context, options);
        const left = this.left.type();
        const right = this.right.type();
        // const infer = type =>Utils.inferTypeValue(type, context.inference);
        // const isObject = (type, exclude=null)=>{
        //     if(exclude === type)return false;
        //     return type.isLiteralObjectType || (type.isGenericType && type.hasConstraint && isObject(type.inherit.type(), type));
        // }
        // const checkNeedMerge = (left, right)=>{
        //     if( left.isGenericType ){
        //         left = infer(left);
        //     }
        //     if( right.isGenericType ){
        //         right = infer(right);
        //     }
        //     if( isObject(left) && isObject(right) ){
        //         return true;
        //     }
        //     if( left.isIntersectionType ){
        //         return checkNeedMerge( left.left.type(), left.right.type() );
        //     }else if( right.isIntersectionType ){
        //         return checkNeedMerge( right.left.type(), right.right.type() );
        //     }
        //     return false;
        // }

        // if( checkNeedMerge(left, right) ){
        //     const origin = Namespace.globals.get('Object');
        //     const merge = new MergeType(origin);
        //     const dataset = {};
        //     const add = (name, type)=>{
        //         if( type.isIntersectionType ){
        //             create(type.left.type(), type.right.type());
        //         }else{
        //             if( dataset[name] ){
        //                 dataset[name].push( type );
        //             }else{
        //                 dataset[name] = [type];
        //             }
        //         }
        //     }
        //     const create = (...args)=>{
        //         let len = args.length
        //         for(let i=0;i<len;i++){
        //             let type = args[i];
        //             if( type.isGenericType ){
        //                 type = infer(type);
        //             }
        //             if(type.isGenericType && type.hasConstraint){
        //                 type = type.inherit;
        //             }
        //             if( type.isLiteralObjectType ){
        //                 type.properties.forEach( (value,prop)=>{
        //                     add(prop, value.type());
        //                 });
        //             }else if(type.isIntersectionType ){
        //                 create(type.left.type(), type.right.type());
        //             }
        //         }
        //     };
        //     create(left, right);
        //     Object.keys(dataset).forEach( key=>{
        //         const types = dataset[key];
        //         if( types.length > 1 ){
        //             const group = new MergeType();
        //             types.forEach( item=>{
        //                 group.add(item);
        //             });
        //             merge.types.set(key, group.type());
        //         }else{
        //             merge.types.set(key, types[0]);
        //         }
        //     });
        //     return merge.type().toString(context);
        // }

        // if( this.target.parentStack.isTypeIntersectionDefinition ){
        //     return `(${left.toString(context,options)} & ${right.toString(context,options)})`
        // }else{
            return `${left.toString(context,options)} & ${right.toString(context,options)}`
        //}
    }
}
module.exports = IntersectionType;