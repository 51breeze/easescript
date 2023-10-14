const Stack = require("../core/Stack");
class JSXExpressionContainer extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isJSXExpressionContainer= true;
        this.jsxElement = parentStack.jsxElement;
        this.expression = this.createTokenStack( compilation, node.expression, scope, node,this );
    }
    freeze(){
        super.freeze();
        this.expression.freeze();
    }
    definition(context){
        const desc = this.expression.description();
        if( desc ){
            const def = desc.definition( context );
            if( def )return def;
        }
        return null;
    }
    reference(){
        return this.expression.reference();
    }
    referenceItems(){
        return this.expression.referenceItems();
    }
    description(){
        return this.expression.description();
    }
    type(ctx){
        return this.expression.type(ctx);
    }
    parser(){
        this.expression.parser();
        this.setRefBeUsed( this.description() );
    }
    value(){
        return this.expression.value();
    }
    raw(){
        return this.expression.raw();
    }
}

module.exports = JSXExpressionContainer;