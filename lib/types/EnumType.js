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
        return this.target.attribute(property);
    }
    get attributes(){
        return this.target.attributes;
    }
    is( type, context,options={}){
        if( !type || !(type instanceof Type) )return false;
        type = this.getWrapAssignType(type);
        if( !this.isNeedCheckType(type) )return true;
        if( type.isUnionType ){
            return type.elements.every( item=>this.is( item.type(), context,options) );
        }
        if( this.owner ){
            return this.inherit.type().is( type, context, options);
        }
        return type.isEnumType && type.owner === this;
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