const Expression = require("./Expression");
const LiteralArrayType = require("../types/LiteralArrayType");
const Namespace = require("../core/Namespace");
const MergeType = require("../core/MergeType");
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
    dynamicAttribute(type, ctx=null){
        const arrClass = Namespace.globals.get('Array');
        if( type && arrClass ){
           return arrClass.dynamicAttribute(type, ctx);
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
        return this.getAttribute('type', ()=>{
            return new LiteralArrayType(Namespace.globals.get("array"), this)
        })
    }
    formatType(){
        return this.getAttribute('formatType',()=>{
            if(this.elements.length>1){
                const mergeType = new MergeType(Namespace.globals.get('Array'));
                mergeType.target = this
                this.elements.forEach( item=>{
                    mergeType.add(item);
                });
                return mergeType.type();
            }
            return this.type();
        })
    }
    parser(){
        if(super.parser()===false)return false;
        this.elements.forEach(item=>{
            item.parser();
            item.setRefBeUsed();
        });
    }
    value(){
        return `[${this.elements.map(elem=>elem.value()).join(',')}]`;
    }
}

module.exports = ArrayExpression;