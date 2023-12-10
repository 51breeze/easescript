const Stack = require("../core/Stack");
const IntersectionType = require("../types/IntersectionType");
class TypeIntersectionDefinition extends Stack {
    constructor(compilation,node,scope,parentNode,parentStack){ 
        super(compilation,node,scope,parentNode,parentStack);
        this.isTypeIntersectionDefinition= true;
        this.left = this.createTokenStack(compilation,node.left,scope,node,this);
        this.right = this.createTokenStack(compilation,node.right,scope,node,this);
    }
    freeze(){
        super.freeze();
        this.left.freeze();
        this.right.freeze();
    }
    definition(ctx){
        ctx = ctx || this.getContext();
        return this.type().definition(ctx);
    }
    description(){
        return this;
    }
    referenceItems(){
        return [this];
    }
    setRefBeUsed(){}
    type(){
        return this.getAttribute('type',()=>{
            return new IntersectionType(this, this.left.type(), this.right.type() );
        });
    }
    parser(){
        if(super.parser()===false)return false;
        this.left.parser()
        this.right.parser()
        
    }
    value(){
        if( this.parentStack.isTypeIntersectionDefinition || !this.parentStack.isTypeUnionDefinition ){
            return `${this.left.value()} & ${this.right.value()}`;
        }else{
            return `(${this.left.value()} & ${this.right.value()})`;
        }
    }
    raw(){
        return this.value();
    }
}

module.exports = TypeIntersectionDefinition;