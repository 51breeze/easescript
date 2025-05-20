const Stack = require("../core/Stack");
const InferGenericType = require("../types/InferGenericType");
class TypeInferDefinition extends Stack {
    constructor(compilation,node,scope,parentNode,parentStack){ 
        super(compilation,node,scope,parentNode,parentStack);
        this.isTypeInferDefinition= true;
        this.argument = this.createTokenStack(compilation,node.argument, scope, node, this);
        this.expression = this.createTokenStack(compilation,node.expression, scope, node, this);
        const name = this.argument.value();
        const def = scope.define(name);
        if(def && this.is(def) && def.scope === this.scope){
            this.argument.error(1056,name);
        }else {
            scope.define(name, this);
        }
    }

    definition(ctx){
       return null;
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
        return this.getAttribute('type', ()=>{ 
            return new InferGenericType(this);
        });
    }

    parser(){
        if(super.parser()===false)return false;
        this.argument.parser();
        if(this.expression){
            this.expression.parser()
        }
    }

    value(){
        return this.argument.value();
    }

    raw(){
        return super.raw();
    }
}

module.exports = TypeInferDefinition;