const Expression = require("./Expression");
const LiteralObjectType = require("../types/LiteralObjectType");
const keySymbol = Symbol("key");
class ObjectExpression extends Expression{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isObjectExpression= true;
        this.attributes = new Map();
        this.dynamicProperties = null;
        this.properties = node.properties.map( item=>{
            const stack = this.createTokenStack( compilation, item, scope, node,this );
            if( !stack.isSpreadElement ){
                const name = stack.value();
                if( this.attributes.has(name) ){
                    stack.error(1045,name)
                }else{
                    this.attributes.set( stack.value(), stack );
                }
                this.hasChildComputed = this.hasChildComputed || stack.computed;
            }
            return stack;
        });
        this[keySymbol] = {};
    }
    freeze(){
        super.freeze();
        super.freeze( this.properties );
        (this.properties || []).forEach( stack=>stack.freeze() );
    }
    definition(ctx){
        const context= this.parentStack.isProperty && this.parentStack.parentStack.isObjectExpression ? this.parentStack : this;
        return {
            comments:context.comments,
            expre: this.type().toString(ctx||this.getContext()),
            location:context.getLocation(),
            file:context.compilation.file,
        };
    }
    attribute(name,value){
        if( value !== void 0 ){
            this.attributes.set(name,value);
            return value;
        }
        return this.attributes.get(name) || null;
    }
    hasAttribute(name){
        return this.attributes.has(name);
    }
    reference(){
        return this;
    }
    referenceItems(){
        return [this];
    }
    description(){
        return this;
    }
    type(){
        return this[keySymbol]._type || (this[keySymbol]._type = new LiteralObjectType(this.getGlobalTypeById("object"),this));
    }
    parser(){
        if( !super.parser() )return false;
        let cache = {};
        this.properties.forEach( item=>{
            item.parser();
            if( item.isSpreadElement ){
                const propertyType = item.type();
                if( propertyType && !propertyType.isAnyType ){
                    if( propertyType.isLiteralObjectType ){
                        const attributes = propertyType.attributes;
                        const dynamicProperties = propertyType.dynamicProperties;
                        if( attributes ){
                            attributes.forEach( (value,key)=>{
                                const property = cache[key];
                                let result = true;
                                if( property ){
                                    result = this.checkExpressionType( property.type(), value, item);
                                }
                                if(result)this.attributes.set(key, value);
                            });
                        }
                        if( dynamicProperties ){
                            if( !this.dynamicProperties ){
                                this.dynamicProperties = new Map();
                            }
                            dynamicProperties.forEach( (value,key)=>{
                                const property = this.dynamicProperties.get(key);
                                let result = true;
                                if( property ){
                                    result = this.checkExpressionType( property.type(), value,  item);
                                }
                                if(result)this.dynamicProperties.set(key,value);
                            });
                        }
                    }
                }
            }else{
                cache[ item.value() ] = item;
            }
        });
        cache = null;
        return true;
    }
    value(){
        return `{${this.properties.map(item=>item.value()).join(', ')}}`
    }
}

module.exports = ObjectExpression;