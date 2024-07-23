const Namespace = require("../core/Namespace");
const LiteralObjectType = require("../types/LiteralObjectType");
const Expression = require("./Expression");
const keySymbol = Symbol("key");
class TypeObjectDefinition extends Expression{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isTypeObjectDefinition= true;
        this.attributes = new Map();
        this.dynamicProperties = new Map();
        this.callDefinitions = null
        const dynamicProperties = [];
        this.properties = node.properties.map( item=>{
            const stack = this.createTokenStack( compilation, item, scope, node,this );
            if( !stack.dynamic ){
                const name = stack.value();
                if(name==='#new#' || name==='#call#'){
                    const dataset = this.callDefinitions || (this.callDefinitions = new Map());
                    let defs = dataset.get(name);
                    if(!defs){
                        dataset.set(name,defs=[]);
                    }
                    defs.push(stack.init);
                    return stack;
                }
                if( this.attributes.has(name) ){
                    stack.error(1045,name)
                }else{
                    this.attributes.set( stack.value(), stack );
                }
            }else{
                dynamicProperties.push(stack)
            }
            return stack;
        });
        if(dynamicProperties.length>0){
            this.compilation.hookAsync('compilation.create.after',()=>{
                dynamicProperties.forEach( item=>{
                    if(item.acceptType){
                        this.dynamicProperties.set(item.acceptType.type(), item);
                    }else{
                        this.dynamicProperties.set(item.key.type(), item);
                    }
                });
            });
        }
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
    dynamicAttribute(propertyType, context=null){
        const properties = this.dynamicProperties;
        if( properties ){
            for(let [key, value] of properties){
                if( key.check( propertyType, context ) ){
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
        if( this.parentStack.isTypeStatement ||  this.parentStack.isDeclaratorTypeAlias){
            return this.parentStack.definition(ctx);
        }
        ctx = ctx || this.getContext();
        const type = this.type().toString(ctx);
        return {
            comments:this.comments,
            expre:`(type) ${type}`,
            location:this.getLocation(),
            file:this.compilation.file,
        }
    }
    description(){
        return this;
    }
    setRefBeUsed(){}
    type(){
        return this.getAttribute('type',()=>{
            return new LiteralObjectType(Namespace.globals.get("object"),this);
        })
    }
    parser(){
        if(super.parser()===false)return false;
        this.properties.forEach( item=>{
            item.parser();
            // if( item.dynamic && item.acceptType ){
            //     this.dynamicProperties.set( Utils.getOriginType( item.acceptType.type() ), item );
            // }
        });
    }
    value(){
        return super.raw();
    }
}

module.exports = TypeObjectDefinition;