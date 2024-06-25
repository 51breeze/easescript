const Namespace = require("../core/Namespace");
const Stack = require("../core/Stack");
const PredicateType = require("../types/PredicateType");
class TypePredicateDefinition extends Stack {
    constructor(compilation,node,scope,parentNode,parentStack){ 
        super(compilation,node,scope,parentNode,parentStack);
        this.isTypePredicateDefinition= true;
        this.argument = this.createTokenStack(compilation,node.argument,scope,node,this)
        this.value = this.createTokenStack(compilation,node.value,scope,node,this)
    }
    freeze(){
        super.freeze();
        this.argument.freeze();
        this.value.freeze();
    }
    definition(ctx){
        return this.type().definition(ctx);
    }
    description(){
        return this;
    }
    referenceItems(){
        return [this];
    }
    type(){
        return this.getAttribute('type',()=>{
            return new PredicateType(Namespace.globals.get('boolean'), this.value, this.argument)
        })
    }
    parser(){
        if(super.parser()===false)return false;
        this.value.parser();
        let desc = null;
        let pp = this.parentStack;
        if(this.argument.isIdentifier && (pp.isFunctionExpression || pp.isTypeFunctionDefinition || pp.isDeclaratorFunction)){
            let key =  this.argument.value();
            pp.params.find( stack=>{
                if(stack.isDeclarator){
                    if(stack.value() === key){
                        desc = stack;
                        return true;
                    }
                }else if(stack.isObjectPattern){
                    return stack.properties.some( item=>{
                        if(item.isProperty){
                            if(item.init.value() === key){
                                desc = item.init;
                                return true;
                            }
                        }
                    });
                }else if(stack.isArrayPattern){
                    return stack.elements.some( item=>{
                        if(stack.value() === key){
                            desc = item;
                            return true;
                        }
                    });
                }
            });
        }else{
            desc = this.argument.description();
        }
        
        if(!desc){
            this.argument.error(1013, this.argument.value());
        }else{
            if(!desc.isParamDeclarator){
                this.argument.error(1196, this.argument.value());
            }
            this.argument.setRefBeUsed(desc);
        }
    }

    value(){
        return this.expression.value();
    }

    raw(){
        return this.expression.raw();
    }
}

module.exports = TypePredicateDefinition;