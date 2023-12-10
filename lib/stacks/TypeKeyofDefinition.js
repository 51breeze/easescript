const Stack = require("../core/Stack");
const KeyofType = require("../types/KeyofType");
class TypeKeyofDefinition extends Stack {
    constructor(compilation,node,scope,parentNode,parentStack){ 
        super(compilation,node,scope,parentNode,parentStack);
        this.isTypeKeyofDefinition= true;
        this.argument = this.createTokenStack(compilation,node.value,scope,node,this)
    }
    freeze(){
        super.freeze();
        this.argument.freeze();
    }
    definition(ctx){
        ctx = ctx || this.getContext();
        return this.type().definition(ctx);
    }
    description(){
        return this.argument.argument.description();
    }
    referenceItems(){
        return [this];
    }
    setRefBeUsed(){}
    type(){
        return this.getAttribute('type',()=>{
            let type = this.argument.type();
            if( type ){
                return new KeyofType(this, type);
            }else{
                return this.getGlobalTypeById('never');
            }
        });
    }
    parser(){
        if(super.parser()===false)return false;
        this.argument.parser();
        if( !this.argument.isTypeTypeofDefinition ){
            const target = this.argument.isTypeDefinition ?  this.argument.argument : this.argument;
            const desc = target.description();
            if( !desc || !(desc.isTypeDefinition || desc.isGenericTypeDeclaration || desc.isTypeStatement || desc.isModule) ){
                target.error(1083, target.value());
            }
        }
    }
    value(){
        return this.argument.value();
    }
    raw(){
        return this.argument.value();
    }
}

module.exports = TypeKeyofDefinition;