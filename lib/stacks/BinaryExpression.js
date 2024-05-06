const Utils = require("../core/Utils");
const UnionType = require("../types/UnionType");
const Expression = require("./Expression");
const shortGlobals = [
    'int',
    'uint',
    'double',
    'number',
    'float',
    'array',
    'string',
    'boolean',
    'regexp',
    'object',
    'class',
]

class BinaryExpression extends Expression{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isBinaryExpression= true;
        this.left = this.createTokenStack( compilation, node.left, scope, node,this );
        this.right = this.createTokenStack( compilation, node.right, scope, node,this );
        this.operator = this.node.operator;
        const operator = this.operator;
        this.isIsOperatorFlag = operator ==="instanceof" || operator ==="is";
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

            let rightType = this.right.type();
            let pp = this.parentStack;
            if(pp && pp.isLogicalExpression)pp = pp.parentStack;

            if(pp.isIfStatement || pp.isConditionalExpression){
                
                if((!lType || lType.isAnyType) && rightType && !rightType.isAnyType && lDesc){
                    const scope =pp.consequent.scope;
                    const condition = pp.isIfStatement ? pp.condition : pp.test;
                    if(scope && scope.isBlockScope){
                        let _type = scope.getPredicateType(lDesc, true);
                        if(_type){
                            if(condition.isLogicalExpression){
                                if(condition.operator.charCodeAt(0) === 38){
                                    this.warn(1187)
                                }else{
                                    if( _type.isUnionType ){
                                        _type.elements.push(rightType)
                                    }else{
                                        _type = new UnionType([_type, rightType]);
                                        scope.setPredicateType(lDesc, _type)
                                    }
                                }
                            }else if(rightType.is(_type)){
                                scope.setPredicateType(lDesc, rightType)
                                this.warn(1186, this.raw())
                            }
                        }else{
                            scope.setPredicateType(lDesc, rightType)
                        }
                    }
                }
            }

            if(rightType.isAliasType && shortGlobals.includes(rightType.id)){
                rightType = rightType.inherit.type();
            }

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