const Stack = require("../core/Stack");
class SpreadElement  extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isSpreadElement=true;
        this.argument = this.createTokenStack( compilation, node.argument, scope, node, this );
    }
    freeze(){
        super.freeze();
        this.argument.freeze();
    }
    definition(){
        return null;
    }
    description(){
        return this.argument.description();
    }
    reference(){
        return this.argument.reference();
    }
    referenceItems(){
        return this.argument.referenceItems();
    }
    key(){
        return this.argument.key();
    }
    type(ctx){
        return this.argument.type(ctx);
    }
    parser(){
        if(super.parser()===false)return false;
        this.argument.parser();
        this.argument.setRefBeUsed();
        const type = this.type();
        if( this.parentStack.isArrayExpression ){
            const arrayType = this.getGlobalTypeById("array");
            const iteratorType = this.getGlobalTypeById("Iterator");
            if( !( arrayType.is( type ) || type.is(iteratorType) ) ){
                this.error(1073,this.argument.value())
            }  
        }else if( this.parentStack.isObjectExpression ){
            const objectType = this.getGlobalTypeById("object");
            if( !objectType.is(type) ){
                this.error(1074,this.argument.value())
            }
        }
    }
    value(){
        return this.argument.value();
    }
    raw(){
        return this.argument.raw();
    }
    error(code,...args){
        this.argument.error(code,...args);
    }
    warn( code,...args ){
        this.argument.warn(code,...args);
    }
}

module.exports = SpreadElement;