const Stack = require("../core/Stack");
const BlockScope = require("../scope/BlockScope");
class BlockStatement extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        if( parentStack && 
            !(parentStack.isFunctionDeclaration || 
            parentStack.isFunctionExpression || 
            parentStack.isArrowFunctionExpression || 
            parentStack.isForOfStatement || 
            parentStack.isForInStatement || 
            parentStack.isForStatement || 
            parentStack.isWhenStatement) 
        ){
            scope = new BlockScope(scope);
        }
        super(compilation,node,scope,parentNode,parentStack);
        this.isBlockStatement= true;
        this.body = [];
        for(const item of node.body){
            const stack = this.createTokenStack( compilation, item, scope, node, this );
            if( stack ){
                this.body.push( stack );
            }
        };
    }

    freeze(){
        super.freeze(this);
        super.freeze(this.scope);
        super.freeze(this.body);
        this.body.forEach( stack=>stack.freeze() );
    }

    definition(){
        return null;
    }

    async parser(){
        return await this.callParser(async ()=>{
            await this.allSettled(this.body, async(item)=>await item.parser())
        })
    }
}

module.exports = BlockStatement;