const Stack = require("../core/Stack");
const ConditionType = require("../types/ConditionType");
class TypeConditionDefinition extends Stack {
    constructor(compilation,node,scope,parentNode,parentStack){ 
        super(compilation,node,scope,parentNode,parentStack);
        this.isTypeConditionDefinition= true;
        this.argument = this.createTokenStack(compilation,node.argument, scope, node, this);
        this.extends = this.createTokenStack(compilation,node.extends, scope, node, this);
    }

    definition(ctx){
       
    }

    description(){
        
    }

    reference(){
        return this;
    }

    referenceItems(){
        return [this];
    }

    setRefBeUsed(){}

    type(){
        return this.getAttribute('type', ()=>{
            return new ConditionType(this);
        });
    }

    parser(){
        if(super.parser()===false)return false;
        this.argument.parser()
        this.extends.parser()
    }

    value(){
        return this.raw();
    }

    raw(){
        return super.raw();
    }
}

module.exports = TypeConditionDefinition;