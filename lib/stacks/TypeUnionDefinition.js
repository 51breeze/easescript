const Stack = require("../core/Stack");
const UnionType = require("../types/UnionType");
const keySymbol = Symbol("key");
class TypeUnionDefinition extends Stack {
    constructor(compilation,node,scope,parentNode,parentStack){ 
        super(compilation,node,scope,parentNode,parentStack);
        this.isTypeUnionDefinition= true;
        this.elements = node.elements.map( item=>{
            const stack = this.createTokenStack(compilation,item,scope,node,this);
            return stack;
        });
        this[keySymbol]={};
    }
    freeze(){
        super.freeze();
        super.freeze( this.elements );
        this.elements.forEach( stack=>stack.freeze() );
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
    setRefBeUsed(){
    }
    type(){
        if( !this[keySymbol]._type ){
            if( this.elements.length > 1 ){
                if( this.elements.some( stack=>stack.isTypeDefinition && stack.valueType.isIdentifier && stack.valueType.value() ==='any') ){
                    this[keySymbol]._type = this.getGlobalTypeById('any');
                }else{
                    this[keySymbol]._type = new UnionType( this.elements, this);
                }
            }else{
                this[keySymbol]._type = this.elements[0].type();
            }
        }
        return this[keySymbol]._type;
    }
    parser(){
        this.elements.forEach( item=>item.parser() );
    }

    value(){
        const elements = this.elements.map( item=>{
            return item.value()
        });
        return `${elements.join("|")}`;
    }
    raw(){
        return this.value();
    }
}

module.exports = TypeUnionDefinition;