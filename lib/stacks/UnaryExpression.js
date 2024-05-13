const Namespace = require("../core/Namespace");
const Expression = require("./Expression");
class UnaryExpression extends Expression {
    constructor(compilation,node,scope,parentNode,parentStack){ 
        super(compilation,node,scope,parentNode,parentStack);
        this.isUnaryExpression= true;
        this.argument = this.createTokenStack( compilation, node.argument, scope, node,this );
        this.operator = node.operator;
        this.isLogicalTrueFlag = false;
        this.isLogicalFlag = false;
        if(this.operator && this.operator.charCodeAt(0) === 33){
            this.isLogicalFlag = true;
            this.isLogicalTrueFlag = this.operator.length % 2 === 0;
        }
    }
    freeze(){
        super.freeze();
        this.argument.freeze();
    }
    definition(){
        return this.argument.definition();
    }
    description(){
        return this.argument.description();
    }
    reference(){
        return this.argument.reference()
    }
    referenceItems(){
        return this.argument.referenceItems()
    }
    getContext(){
        return this.argument.getContext()
    }
    parser(){
        if(super.parser()===false)return false;
        this.argument.parser();
        this.argument.setRefBeUsed();
        const operator = this.node.operator;
        const code = operator.charCodeAt(0);
        if( code === 45 || code === 43 ){
            const numberType =Namespace.globals.get("Number");
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
            return Namespace.globals.get("boolean");
        }
        if( code === 45 || code === 43 ){
            const numberType = Namespace.globals.get("Number");
            const type = this.argument.type();
            if( type.isAnyType || !numberType.is( type ) ){
                return Namespace.globals.get("int");
            }
            return type;
        }
        if( operator === 'typeof' ){
            return Namespace.globals.get("string");
        }else if( operator ==="void" ){
            return Namespace.globals.get("void");
        }
        return this.argument.type();
    }
}

module.exports = UnaryExpression;