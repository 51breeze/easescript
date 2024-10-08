const Stack = require("../core/Stack");
class GenericDeclaration extends Stack {
    constructor(compilation,node,scope,parentNode,parentStack){ 
        super(compilation,node,scope,parentNode,parentStack);
        this.isGenericDeclaration= true;
        this.elements = node.elements.map( item=>{
            const stack = this.createTokenStack(compilation,item,scope,node,this);
            const fnScope = scope.getScopeByType("function");
            const name = stack.value();
            const def = scope.define(name);
            if(def && this.is(def) && def.scope.getScopeByType("function") === fnScope ){
                stack.error(1056,name);
            // }else if(this.getTypeById(name)){
            //     stack.error(1057,name);
            }else {
                scope.define(name, stack);
            }
            return stack;
        });
    }
    freeze(){
        super.freeze(this);
        super.freeze(this.elements);
    }
    description(){
        return this;
    }
    definition(){
        return null;
    }
    type(){
        return null;
    }
    parser(){
        if(super.parser()===false)return false;
        let isAssignLast = false;
        this.elements.forEach( item=>{
            item.parser();
            const isAssign = item.isGenericTypeAssignmentDeclaration;
            if( isAssignLast && !isAssign){
                item.error(1058);
            }
            isAssignLast = item.isGenericTypeAssignmentDeclaration;
        });
    }
    value(){
        const elements = this.elements.map( item=>{
            return item.value()
        });
        return `<${elements.join(",")}>`;
    }
    raw(){
        const elements = this.elements.map( item=>{
            return item.raw();
        });
        return `<${elements.join(",")}>`;
    }
}

module.exports = GenericDeclaration;