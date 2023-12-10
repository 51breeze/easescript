const Utils = require("../core/Utils");
const Expression = require("./Expression");
class BinaryExpression extends Expression{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isBinaryExpression= true;
        this.left = this.createTokenStack( compilation, node.left, scope, node,this );
        this.right = this.createTokenStack( compilation, node.right, scope, node,this );
        this.operator = this.node.operator;
    }
    freeze(){
        super.freeze();
        this.left.freeze();
        this.right.freeze();
    }
    definition(){
        return null;
    }
    reference(){
        return this;
    }
    referenceItems(){
        return [this];
    }
    description(){
        return this;
    }
    
    type(ctx){
        const operator = this.operator;
        if( operator ==="instanceof" || operator ==="is" ){
            return this.getGlobalTypeById("boolean");
        }else{
            const code = operator.charCodeAt(0);
            if( code === 33 || code === 60 || code===61 || code===62 ){
                return this.getGlobalTypeById("boolean");
            }else if(code ===43){
                const stringType = this.getGlobalTypeById("string");
                if( stringType.check(this.left,ctx) || stringType.check(this.right,ctx) ){
                    return stringType;
                } 
            }
            return this.getGlobalTypeById("number");
        }
    }
    parser(){
        if(super.parser()===false)return false;
        this.left.parser();
        this.left.setRefBeUsed();
        this.right.parser();
        this.right.setRefBeUsed();
        const operator = this.node.operator;
        if( operator ==="instanceof" || operator ==="is" ){
            const lDesc = this.left.description();
            const lType = this.left.type();
            if( lType ){
                if( (lDesc && Utils.isTypeModule(lDesc)) || lType.isLiteralType || lType.isClassType || lType.isClassGenericType ){
                    this.left.error(1019,this.left.value());
                }
            }
            const rightType = this.right.description();
            if( !Utils.isTypeModule( rightType ) ){
                if( !rightType || !rightType.isAnyType ){
                    this.right.error(1021,operator);
                }
            }else{
                this.compilation.addDependency(rightType,this.module);
            }
        }
    }
}

module.exports = BinaryExpression;