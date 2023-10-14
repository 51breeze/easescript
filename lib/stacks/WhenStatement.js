const Stack = require("../core/Stack");
const BlockScope = require("../scope/BlockScope");
class WhenStatement extends Stack{

    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isWhenStatement= true;
        this.condition = this.createTokenStack(compilation,node.test,scope,node,this);
        this.consequent = this.createTokenStack(compilation,node.consequent,new BlockScope(scope),node,this);
        this.alternate = this.createTokenStack(compilation,node.alternate,new BlockScope(scope),node,this);
    }

    freeze(){
        super.freeze();
        this.condition.freeze();
        this.consequent.freeze();
        this.alternate.freeze();
    }

    definition(){
        return null;
    }

    parser(){
        this.consequent.parser();
        this.consequent.setRefBeUsed();
        this.alternate && this.alternate.parser();
        if( this.condition && this.condition.isCallExpression ){
            const name = this.condition.callee.value();
            const methods = this.compiler.options.metaStatementMethods||[];
            if(methods.length > 0 && !methods.includes( name ) ){
                this.condition.error(1165, name, methods.join(','));
            }
        }else{
            this.condition.error(1006, this.condition.value());
        }
    }
}

module.exports = WhenStatement;