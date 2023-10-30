const Expression = require("./Expression");
const LiteralArrayType = require("../types/LiteralArrayType");
const keySymbol = Symbol("key");
class ArrayExpression extends Expression{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isArrayExpression=true;
        this.elements = [];
        this.spreadElement = []
        node.elements.map( (item)=>{
            const stack = this.createTokenStack(compilation,item,scope,node,this);
            if(stack){
                this.elements.push( stack );
            }
        });
        this[keySymbol]={};
    }
    freeze(){
        super.freeze(this);
        super.freeze(this.elements);
        this.elements.forEach(stack=>stack.freeze());
    }
    definition(){
        return null;
    }
    attribute(index){
        if( typeof index === 'number'){
            return this.elements[index] || null;
        }
        return null;
    }
    dynamicAttribute(type){
        const arrClass = this.getGlobalTypeById('Array');
        if( type && arrClass ){
           return arrClass.dynamicAttribute(type);
        }
        return null;
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
        return this[keySymbol]._type || (this[keySymbol]._type = new LiteralArrayType( this.getGlobalTypeById("array"), this ) );
    }
    parser(){
        this.elements.forEach( item=>{
            item.parser();
            item.setRefBeUsed();
        });
    }
    value(){
        return `[${this.elements.map(elem=>elem.value()).join(',')}]`;
    }
}

module.exports = ArrayExpression;