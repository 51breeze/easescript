const Type = require("./Type");
class EnumType extends Type{
    constructor(inherit,target,owner=null){
        super("$EnumType",inherit);
        this.target = target;
        this.isEnumType = true;
        this.owner = owner;
        this.acceptProperties = [];
    }
    accept( property ){
        this.acceptProperties.push( property );
    }
    attribute( property ){
        if(this.target && this.target.isEnumDeclaration){
            return this.target.attribute(property);
        }
        return null
    }
    get attributes(){
        if(this.target && this.target.isEnumDeclaration){
            return this.target.attributes;
        }
        return null;
    }
    dynamicAttribute(propertyType, context=null, property=null){
        if(property && this.target && this.target.isEnumDeclaration){
            const type = typeof property
            if(type ==='number' || type ==='string'){
                return this.target.properties.find(attr=>attr.init.value() === property)
            }
        }
        return null
    }
    is(type, context,options={}){
        if( !type || !(type instanceof Type) )return false;
        type = this.inferType(type, context);
        type = this.getWrapAssignType(type);
        if( !this.isNeedCheckType(type) )return true;
        if( type.isUnionType ){
            return type.elements.every( item=>this.is( item.type(), context,options) );
        }
        if(!type.isEnumType){
            if(type.isLiteralType && this.target){
                if(this.target.isEnumProperty){
                    return type.value === this.target.init.value()
                }else if(this.target.isEnumDeclaration){
                    return this.target.properties.some( attr=>attr.init.value() === type.value )
                }
            }
            return false;
        }
        if(type.owner === this)return true;
        return type.owner === this.owner;
    }
    toString(context,options={}){
       if(this.owner){
          if( this.owner.isEnumType ){
              return `${this.owner.target.key.value()}`;
          }else{
              return `${this.owner.id}.${this.target.value()}`;
          }
       }
       let properties = [];
       const inherit = this.inherit;
       if( inherit && inherit.isModule && inherit.isEnum ){
            properties = Object.keys(inherit.methods);
       }else{
            properties = this.target.properties.map( item=>item.value() );
       }
       return `enum {${properties.join(",")}}`;
    }
}
module.exports = EnumType;