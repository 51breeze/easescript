const Namespace = require("../core/Namespace");
const Expression = require("./Expression");
class UpdateExpression extends Expression {
    constructor(compilation,node,scope,parentNode,parentStack){ 
        super(compilation,node,scope,parentNode,parentStack);
        this.isUpdateExpression= true;
        this.argument = this.createTokenStack( compilation, node.argument, scope, node,this );
        this.operator = node.operator;
        this.prefix = node.prefix;
    }
    freeze(){
        super.freeze();
        this.argument.freeze();
    }
    definition(){
        return null;
    }
    description(){
        return this;
    }
    
    parser(){
        if(super.parser()===false)return false;
        this.argument.parser();
        this.argument.setRefBeUsed();
        const type = this.argument.type();
        const numberType = Namespace.globals.get("Number");
        if( type && !type.isAnyType && !numberType.is( type ) ){
            this.error(1087, this.argument.raw() );
        }
    }

    type(ctx){
        const numberType = Namespace.globals.get("Number");
        const type = this.argument.type(ctx);
        if( type.isAnyType || !numberType.is( type ) ){
            return Namespace.globals.get("int");
        }
        return this.argument.type(ctx);
    }
}

module.exports = UpdateExpression;