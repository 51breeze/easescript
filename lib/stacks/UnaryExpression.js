const Expression = require("./Expression");
class UnaryExpression extends Expression {
    constructor(compilation,node,scope,parentNode,parentStack){ 
        super(compilation,node,scope,parentNode,parentStack);
        this.isUnaryExpression= true;
        this.argument = this.createTokenStack( compilation, node.argument, scope, node,this );
        this.operator = node.operator;
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
        const operator = this.node.operator;
        const code = operator.charCodeAt(0);
        if( code === 45 || code === 43 ){
            const numberType = this.getGlobalTypeById("Number");
            const type = this.argument.type();
            if( type && !type.isAnyType && !numberType.is( type ) ){
                this.error(1087, this.argument.raw() );
            }
            return type;
        }
    }

    value(){
        return super.raw();
    }

    type(){
        const operator = this.node.operator;
        const code = operator.charCodeAt(0);
        if( code === 33 ){
            return this.getGlobalTypeById("boolean");
        }
        if( code === 45 || code === 43 ){
            const numberType = this.getGlobalTypeById("Number");
            const type = this.argument.type();
            if( type.isAnyType || !numberType.is( type ) ){
                return this.getGlobalTypeById("int");
            }
            return type;
        }
        if( operator === 'typeof' ){
            return this.getGlobalTypeById("string");
        }else if( operator ==="void" ){
            return this.getGlobalTypeById("any");
        }
        return this.argument.type();
    }
}

module.exports = UnaryExpression;