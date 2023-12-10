const Stack = require("../core/Stack");
class SwitchCase  extends Stack {
    constructor(compilation,node,scope,parentNode,parentStack){ 
        super(compilation,node,scope,parentNode,parentStack);
        this.isSwitchCase=true;
        this.condition = this.createTokenStack( compilation, node.test, scope, node,this );
        this.consequent = node.consequent.map( item=>this.createTokenStack( compilation, item, scope, node,this ) ).filter( item=>!!item );
    }
    freeze(){
        super.freeze();
        super.freeze( this.consequent );
        this.condition.freeze();
        this.consequent.forEach( stack=>stack.freeze() );
    }
    
    definition(){
        return null;
    }
    parser(){
        if(super.parser()===false)return false;
        if(this.condition){
            this.condition.parser();
            this.condition.setRefBeUsed();
        }
        this.consequent.forEach(item=>item.parser() );
    }
    
}

module.exports = SwitchCase;