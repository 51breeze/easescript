const Utils = require("../core/Utils");
const Expression = require("./Expression");
class ThisExpression  extends Expression {
    constructor(compilation,node,scope,parentNode,parentStack){ 
        super(compilation,node,scope,parentNode,parentStack);
        this.isThisExpression= true;
    }
    definition(){
        return {
            expre:`this: this`,
            location:this.getLocation(),
            file:this.compilation.file,
        };
    }
    reference(){
        return this;
    }
    description(){
        return this;
    }
    referenceItems(){
        return [this];
    }
    type(){
        return this.scope.define( this.value() );
    }
    value(){
        return `this`;
    }
    raw(){
        return `this`; 
    }
    parser(){
        if(super.parser()===false)return false;
        const desc = this.type();
        if( !desc ){
            this.error(1013,this.raw());
        }
    }
}

module.exports = ThisExpression;