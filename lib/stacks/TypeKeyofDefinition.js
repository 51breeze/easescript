const Stack = require("../core/Stack");
const KeyofType = require("../types/KeyofType");
const keySymbol = Symbol("key");
class TypeKeyofDefinition extends Stack {
    constructor(compilation,node,scope,parentNode,parentStack){ 
        super(compilation,node,scope,parentNode,parentStack);
        this.isTypeKeyofDefinition= true;
        this.valueType = this.createTokenStack(compilation,node.value,scope,node,this)
        this[keySymbol]={};
    }
    freeze(){
        super.freeze();
        this.valueType.freeze();
    }
    definition(ctx){
        ctx = ctx || this.getContext();
        return this.type().definition(ctx);
    }
    description(){
        return this.valueType.valueType.description();
    }
    referenceItems(){
        return [this];
    }
    setRefBeUsed(){}
    type(){
        if( !this[keySymbol]._type ){
            let type = this.valueType.type();
            if( type ){
                this[keySymbol]._type = new KeyofType(this, type);
            }else{
                return this.getGlobalTypeById('never');
            }
        }
        return this[keySymbol]._type;
    }
    parser(){
        this.valueType.parser();
        if( !this.valueType.isTypeTypeofDefinition ){
            const target = this.valueType.isTypeDefinition ?  this.valueType.valueType : this.valueType;
            const desc = target.description();
            if( !desc || !(desc.isTypeDefinition || desc.isGenericTypeDeclaration || desc.isTypeStatement || desc.isModule) ){
                target.error(1083, target.value() );
            }
        }
    }
    value(){
        return this.valueType.value();
    }
    raw(){
        return this.valueType.value();
    }
}

module.exports = TypeKeyofDefinition;