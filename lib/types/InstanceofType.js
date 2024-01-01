const Type = require("./Type");
class InstanceofType extends Type{
    constructor(inherit,target,generics=[], isThis=false, newModuleType=null){
        super("$InstanceofType",inherit);
        this.target = target;
        this.isInstanceofType = true;
        this.isThisType = !!isThis;
        if( !generics && !isThis && inherit ){
            const baseType = inherit;
            const declares =baseType.isModule && baseType.getModuleGenerics() || [];
            generics = declares.map( (item)=>{
                return item.type();
            });
        }
        this.newModuleType = newModuleType;
        this.generics = generics || [];
        this.hasGenericType = this.inherit.type().hasGenericType || this.generics.some( type=>!!type.hasGenericType );
    }
    clone( inference ){
        if( !inference || !this.hasGenericType ){
            return this;
        }
        return new InstanceofType( this.inherit.type().clone(inference) , this.target, this.generics.map( type=>type.clone(inference) ), this.isThisType );
    }
    getTypeKeys(){
        let inherit = this.inherit.type();
        if(inherit.isClassGenericType && inherit.isClassType && this.target.isNewExpression){
            inherit = inherit.elements[0].type();
        }
        return inherit.getTypeKeys();
    }
    attribute( property , kind='get'){
        let inherit = this.inherit.type();
        if(inherit.isClassGenericType && inherit.isClassType && this.target.isNewExpression){
            inherit = inherit.elements[0].type();
        }
        return inherit.getMember(property, kind);
    }
    is( type , context,options={}){
        if( !type || !(type instanceof Type) )return false;
        type = this.inferType(type, context);
        type = this.getWrapAssignType(type);
        if( !this.isNeedCheckType(type) )return true;
        if( type.isUnionType ){
            return type.elements.every( item=>this.is(item.type(), context, options) );
        }
        if( type.isAliasType ){
            return this.is(type.inherit.type(), context, options )
        }
        if( this.isThisType && type.isInstanceofType && type.isThisType ){
            return true;
        }
        if( this.target && this.target.isNewExpression && this.target.genericity ){
            const lGenerics = this.target.genericity;
            const tGenerics = type.isInstanceofType && type.target.isNewExpression ? type.target.genericity : null;
            if( !tGenerics || lGenerics.length != tGenerics.length ){
                return false;
            }
            if( !lGenerics.every( (item,index)=>item.type().is( tGenerics[index].type(), context,options ) ) ){
                return false;
            }
        }
        type = type.isInstanceofType ? type.inherit : type;
        if( this.inherit.type().is( type, context,options) ){
            return true;
        }

        if( this.isThisType && type){
            return type.is( this.inherit, context, options );
        }
        return false;
    }
    toString(context,options={}){
        options = Object.assign({},options)
        context = this.pushToStringChain(context, options);
        if( this.isThisType ){
            return 'this';
        }
        let inherit = this.inherit.type();
        if(inherit.isModule && this.generics.length > 0 ){
            return `${inherit.getName()}<${this.generics.map( type=>type.toString(context,options)).join(', ')}>`;
        }
        if(inherit.isClassGenericType && inherit.isClassType && this.target.isNewExpression){
            return inherit.elements[0].type().toString(context,options);
        }
        return inherit.toString(context,options);
    }
}
module.exports = InstanceofType;