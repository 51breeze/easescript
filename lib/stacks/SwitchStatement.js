const Stack = require("../core/Stack");
const BlockScope = require("../scope/BlockScope");
class SwitchStatement  extends Stack {
    constructor(compilation,node,scope,parentNode,parentStack){ 
        super(compilation,node,scope,parentNode,parentStack);
        this.isSwitchStatement=true;
        this.condition = this.createTokenStack(compilation, node.discriminant, scope, node,this );
        scope = new BlockScope(scope);
        this.cases = node.cases.map( item=>{
           return this.createTokenStack( compilation, item, scope, node, this );
        });
    }
    freeze(){
        super.freeze();
        super.freeze( this.cases );
        super.freeze( this.scope );
        this.condition.freeze();
        this.cases.forEach( stack=>stack.freeze() );
    }
    definition(){
        return null;
    }
    parser(){
        if(super.parser()===false)return false;
        this.condition.parser();
        this.condition.setRefBeUsed();
        this.cases.forEach(item=>item.parser());
    }

}

module.exports = SwitchStatement;