const Stack = require("../core/Stack");
const BlockScope = require("../scope/BlockScope");
class SwitchStatement  extends Stack {
    constructor(compilation,node,scope,parentNode,parentStack){ 
        super(compilation,node,scope,parentNode,parentStack);
        this.isSwitchStatement=true;
        this.condition = this.createTokenStack(compilation, node.discriminant, scope, node,this );
        scope = new BlockScope(scope);
        let hasDefault = false;
        this.cases = node.cases.map( item=>{
            if(!hasDefault && !item.test)hasDefault = true;
            return this.createTokenStack( compilation, item, scope, node, this );
        });
        this.hasReturnStatement = false;
        if(hasDefault){
            this.hasReturnStatement = this.cases.every((item)=>!!(item.hasReturnStatement || item.hasThrowStatement));
        }
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