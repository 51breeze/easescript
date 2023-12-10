const Stack = require("../core/Stack");
class LabeledStatement extends Stack{

    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isLabeledStatement= true;
        this.labelChildren = [];
        this.labelParent = null;
        this.label = this.createTokenStack( compilation, node.label, scope, node, this );
        this.body =  this.createTokenStack( compilation, node.body, scope, node, this );
        const labelStack =parentStack && parentStack.getParentStack( stack=>!!(stack.isLabeledStatement || stack.isFunctionExpression) );
        if( labelStack && labelStack.isLabeledStatement ){
            this.labelParent = labelStack;
            labelStack.labelChildren.push(this);
        }
    }

    freeze(){
        super.freeze(this);
        super.freeze(this.label);
        super.freeze(this.labelChildren);
        this.body.freeze();
    }

    definition(){
        return {
            comments:this.label.comments,
            expre:null,
            location:this.label.getLocation(),
            file:this.compilation.file,
        };
    }

    parser(){
        return this.body.parser();
    }
}

module.exports = LabeledStatement;