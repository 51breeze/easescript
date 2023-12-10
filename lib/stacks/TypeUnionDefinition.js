const Stack = require("../core/Stack");
const UnionType = require("../types/UnionType");
class TypeUnionDefinition extends Stack {
    constructor(compilation,node,scope,parentNode,parentStack){ 
        super(compilation,node,scope,parentNode,parentStack);
        this.isTypeUnionDefinition= true;
        this.elements = node.elements.map( item=>{
            const stack = this.createTokenStack(compilation,item,scope,node,this);
            return stack;
        });
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
        return this.getAttribute('type',()=>{
            if( this.elements.length > 1 ){
                if( this.elements.some( stack=>stack.isTypeDefinition && stack.argument.isIdentifier && stack.argument.value() ==='any') ){
                    return this.getGlobalTypeById('any');
                }else{
                    return new UnionType( this.elements, this);
                }
            }else{
                return this.elements[0].type();
            }  
        })
    }
    parser(){
        if(super.parser()===false)return false;
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