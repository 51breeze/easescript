const Namespace = require("../core/Namespace");
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
        if( this.parentStack.isTypeStatement ||  this.parentStack.isDeclaratorTypeAlias){
            return this.parentStack.definition(ctx);
        }
        const type = this.type();
        ctx = ctx || this.getContext();
        return {
            comments:this.comments,
            expre:`(type) ${type.toString(ctx)}`,
            location:this.getLocation(),
            file:this.compilation.file,
        }
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
                if(type.isTypeofType){
                    type = type.origin;
                }
                return new KeyofType(this, type);
            }else{
                return Namespace.globals.get('never');
            }
        });
    }
    parser(){
        if(super.parser()===false)return false;
        this.argument.parser();
        if( !this.argument.isTypeTypeofDefinition ){
            const target = this.argument.isTypeDefinition ?  this.argument.argument : this.argument;
            const desc = target.getReferenceType();
            if(!desc || !(desc.isTypeDefinition || desc.isGenericTypeDeclaration || desc.isGenericTypeAssignmentDeclaration || desc.isDeclaratorTypeAlias || desc.isTypeStatement || desc.isModule) ){
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