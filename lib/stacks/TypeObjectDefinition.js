const Utils = require("../core/Utils");
const LiteralObjectType = require("../types/LiteralObjectType");
const Expression = require("./Expression");
const keySymbol = Symbol("key");
class TypeObjectDefinition extends Expression{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isTypeObjectDefinition= true;
        this.attributes = new Map();
        this.dynamicProperties = new Map();
        this.properties = node.properties.map( item=>{
            const stack = this.createTokenStack( compilation, item, scope, node,this );
            if( !stack.dynamic ){
                const name = stack.value();
                if( this.attributes.has(name) ){
                    stack.error(1045,name)
                }else{
                    this.attributes.set( stack.value(), stack );
                }
            }
            return stack;
        });
        this[keySymbol]={};
    }
    freeze(){
        super.freeze();
        super.freeze( this.attributes );
        this.properties.forEach( stack=>stack.freeze() );
    }
    attribute(name){
        return this.attributes.get(name) || null;
    }
    hasAttribute(name , type){
        return this.attributes.has(name);
    }
    dynamicAttribute(propertyType){
        const properties = this.dynamicProperties;
        if( properties ){
            for(let [key, value] of properties){
                if( key.check( propertyType ) ){
                    return value;
                }
            }
        }
        return null;
    }
    reference(){
        return this;
    }
    referenceItems(){
        return [this];
    }
    definition(ctx){
        ctx = ctx || this.getContext();
        return this.type().definition(ctx);
    }
    description(){
        return this;
    }
    setRefBeUsed(){}
    type(){
        const type = this[keySymbol]._type || (this[keySymbol]._type = new LiteralObjectType(this.getGlobalTypeById("object"),this));
        return type;
    }
    parser(){
        if( !super.parser() )return false;
        this.properties.forEach( item=>{
            item.parser();
            if( item.dynamic && item.acceptType ){
                this.dynamicProperties.set( Utils.getOriginType( item.acceptType.type() ), item );
            }
        });
        return true;
    }
    value(){
        return super.raw();
    }
}

module.exports = TypeObjectDefinition;