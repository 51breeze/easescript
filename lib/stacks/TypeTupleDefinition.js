const Namespace = require("../core/Namespace");
const Stack = require("../core/Stack");
const LiteralArrayType = require("../types/LiteralArrayType");
const TupleType = require("../types/TupleType");
class TypeTupleDefinition extends Stack {
    constructor(compilation,node,scope,parentNode,parentStack){ 
        super(compilation,node,scope,parentNode,parentStack);
        this.isTypeTupleDefinition= true;
        this.prefix = this.createTokenStack(compilation,node.prefix,scope,node,this);
        this.elements = (node.elements||[]).map( item=>{
            const stack = this.createTokenStack(compilation,item,scope,node,this);
            return stack;
        });
    }
    freeze(){
        super.freeze();
        super.freeze( this.elements );
        this.prefix && this.prefix.freeze();
        this.elements.forEach( stack=>stack.freeze() );
    }
    definition(ctx){
        if(this.parentStack.isTypeStatement ||  this.parentStack.isDeclaratorTypeAlias){
            return this.parentStack.definition(ctx);
        }
        const type = this.type();
        ctx = ctx || this.getContext();
        return {
            comments:this.comments,
            expre:`(type) ${type.toString(ctx)}`,
            location:(this.prefix||this).getLocation(),
            file:this.compilation.file,
        };
    }
    description(){
        return this;
    }
    reference(){
        return this;
    }
    referenceItems(){
        return [this];
    }
    setRefBeUsed(){}
    type(){
        return this.getAttribute('type',()=>{
            const elem =  this.prefix ? [this.prefix] : this.elements;
            if( elem.length > 0 ){
                return new TupleType(
                    Namespace.globals.get("Array"),
                    elem,
                    this
                );
            }else{
                return new LiteralArrayType(Namespace.globals.get("Array"), this, []);
            }
        })
    }
    parser(){
        if(super.parser()===false)return false;
        if( this.prefix && this.elements.length > 0){
            this.error(1086, this.prefix.raw() )
        }
        this.prefix && this.prefix.parser();
        this.elements.forEach(item=>item.parser());
        const restElement = this.elements.find( item=>item.restElement);
        if( restElement && restElement !== this.elements[ this.elements.length-1 ] ){
            this.error(1077);
        }
        
    }
}

module.exports = TypeTupleDefinition;