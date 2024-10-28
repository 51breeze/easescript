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
            parentStack.isIfStatement || 
            parentStack.isWhileStatement || 
            parentStack.isWhenStatement) 
        ){
            scope = new BlockScope(scope);
        }
        super(compilation,node,scope,parentNode,parentStack);
        this.isBlockStatement= true;
        this.hasReturnStatement = false;
        this.body = [];
        for(const item of node.body){
            const stack = this.createTokenStack( compilation, item, scope, node, this );
            if(stack){
                if(stack.isReturnStatement || stack.hasReturnStatement || stack.isThrowStatement){
                    this.hasReturnStatement = true;
                }
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

    parser(){
        if(super.parser()===false)return false;
        let fristReturnAt = -1
        this.body.forEach( (item,index)=>{
            item.parser();
            if(fristReturnAt ===-1){
                if(item.hasReturnStatement || item.hasThrowStatement){
                    if(index+1 < this.body.length){
                        fristReturnAt = index;
                    }
                }
            }
        });

        if( fristReturnAt >= 0 ){
            const start = this.body[fristReturnAt+1];
            const end = this.body[this.body.length-1];
            if(start && end){
                const startRange = this.compilation.getRangeByNode(start.node)
                const endRange = this.compilation.getRangeByNode(end.node);
                const range = {
                    loc:{
                        start:startRange.start,
                        end:endRange.end,
                    }
                }
                this.compilation.unnecessary(range,1184);
            }
        }
    }
}

module.exports = BlockStatement;