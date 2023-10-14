const Stack = require("../core/Stack");
class ContinueStatement extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isBreakStatement= true;
        this.label = this.createTokenStack(compilation,node.label,scope,node,this);
    }

    freeze(){
        super.freeze(this);
        this.label && this.label.freeze();
    }

    getLabelStackByName( name ){
        let labelStack = this.getParentStack( stack=>!!(stack.isLabeledStatement || stack.isFunctionExpression) );
        while( labelStack && labelStack.isLabeledStatement ){
            if( labelStack.label.value() === name ){
                return labelStack;
            }
            labelStack = labelStack.labelParent;
        }
        return null;
    }

    definition(context){
        if( this.label ){
            const labelStack = this.getLabelStackByName( this.label.value() );
            if( labelStack ){
                return labelStack.definition( context );
            }
        }
        return null;
    }

    parser(){
        if( !super.parser() )return false;
        if( this.label ){
            const labelStack = this.getLabelStackByName( this.label.value() );
            if( !labelStack || !labelStack.isLabeledStatement ){
                this.label.error( 1022 );
            }
        }
        let parent = this.parentStack;
        while( parent ){
            if( parent.isSwitchCase || 
                parent.isDoWhileStatement || 
                parent.isWhileStatement || 
                parent.isForStatement || 
                parent.isForOfStatement || 
                parent.isForInStatement )
            {
               return true;
            }else if(parent.isFunctionExpression){
               break; 
            }else{
                parent = parent.parentStack;
            }
        }
        this.error(1022);
    }
}

module.exports = ContinueStatement;