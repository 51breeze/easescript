const Type = require("./Type"); 
class UnionType extends Type{
    constructor( elements , target){
        super("$UnionType");
        this.isUnionType = true;
        this.target = target;
        this.elements = elements;
        this.hasGenericType = elements.some( type=>{
            const _type = type.type();
            return _type ? _type.hasGenericType : false;
        })
    }
    clone(inference){
        if(!inference || !this.hasGenericType){
            return this;
        }
        const elements = this.elements.map( item=>item.type().clone(inference) );
        return new UnionType(elements,this.target);
    }
    checkItems( items, context={}, options={} ){
        return items.every(item=>{
            return this.elements.some( base=>base.type().check(item, context, options) );
        });
    }

    checkType(acceptType, assignment, context, options){
        if(!acceptType)return true;
        if(acceptType.isLiteralObjectType){
            return acceptType.constraint(assignment, context, options)
        }
        return acceptType.is(assignment, context, options)
    } 
    
    is(type, context={}, options={}){
        if( !type || !(type instanceof Type) )return false;
        type = this.inferType(type, context);
        type = this.getWrapAssignType(type);
        if( !this.isNeedCheckType(type) )return true;
        if( type.isAliasType ){
            return this.is(type.inherit.type(), context, options )
        }
        if( type.isUnionType ){
            return type.elements.some( item=>{
                return this.elements.some( base=>this.checkType(base.type(), item.type(), context, options) );
            });
        }
        return this.elements.some( base=>this.checkType(base.type(), type, context, options) );
    }

    toString(context, options={}){
        context = this.pushToStringChain(context, options);
        let need = this.elements.length > 1;
        let str = this.elements.map( item=>{
            const type = item.type();
            if( type.isFunctionType && need ){
                return `(${type.toString(context, Object.create(options))})`
            }
            return type.toString(context, options);
        }).join(" | ");
        if( options.hasAnyType ){
            return 'any';
        }
        return str;
    }
}
module.exports = UnionType;