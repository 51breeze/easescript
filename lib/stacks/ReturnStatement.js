const Stack = require("../core/Stack");
const Utils = require("../core/Utils");
const keySymbol = Symbol('key');
class ReturnStatement extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isReturnStatement= true;
        this.argument = this.createTokenStack( compilation, node.argument, scope, node,this );
        const fnScope = scope.getScopeByType("function");
        this.returnIndex = fnScope.returnItems.length;
        if( this.argument ){
            fnScope.returnItems.push( this );
        }
        this[keySymbol]={};
        this.fnScope = fnScope;
    }
    freeze(){
        super.freeze();
        this.argument && this.argument.freeze();
    }
    definition(){
        return null;
    }
    reference(){
        if( this.argument ){
            return this.argument.reference();
        }
        return null;
    }
    referenceItems(){
        return this.argument ? this.argument.referenceItems() : [];
    }
    description(){
        if( this.argument ){
            return this.argument.description();
        }
        return null;
    }
    type(){
        if( !this.argument ){
            return this.getGlobalTypeById("void");
        }
        return this.argument.type();
    }

    getParentFunction(){
        return this.getAttribute('ReturnStatement.getParentFunction',()=>{
            let parent = this.getParentStack( parent=>{
                return !!parent.isFunctionExpression;
            });
            if( parent && (parent.isFunctionExpression || parent.isMethodDefinition) ){
                return parent;
            }
            return null;
        });
    }

    getContext(){
        let parent = this.getParentFunction();
        if( parent ){
            return parent.getContext();
        }
        return super.getContext();
    }

    parser(){
        if(super.parser()===false)return false;
        if( this.argument ){
            this.argument.parser();
            this.argument.setRefBeUsed();
            let parent = this.getParentFunction();
            if( !parent || !parent.isFunctionExpression){
                return this.error(1072);
            }
            if( parent.async ){
                let returnType = parent.getReturnedType();
                const origin = Utils.getOriginType( returnType );
                const PromiseType = this.getGlobalTypeById("Promise");
                if( origin && PromiseType && PromiseType.is(origin) ){
                    let acceptType = null;
                    if( returnType.isInstanceofType && returnType.generics[0] ){
                        acceptType = returnType.generics[0].type();
                    }else if( returnType.isClassGenericType  && returnType.types[0] ){
                        acceptType = returnType.types[0].type();
                    }
                    if( acceptType ){
                        this.checkExpressionType(acceptType, this.argument);
                        return true;
                    }
                }
            }

            if( this.argument ){
                const rType = this.argument.type();
                if( rType && rType.isNullableType ){
                    return true;
                }
                let returnType = parent && parent.returnType;
                if( returnType ){
                    let declareGenerics = parent.genericity ? parent.genericity.elements : [];
                    let assigments = [];
                    if( parent.parentStack && parent.parentStack.isCallExpression ){
                        assigments = parent.parentStack.genericity || assigments; 
                        const [_declareGenerics, _classGenerics] = parent.parentStack.getDeclareGenerics( parent.parentStack.description() );
                        declareGenerics = _declareGenerics;
                    }
                    if( !this.isGenericsRelationValue(returnType, declareGenerics, assigments) ){
                        this.checkExpressionType(returnType, this.argument);
                    }
                }
            }
        }
    }

    value(){
        return this.argument ? this.argument.value() : '';
    }

    raw(){
        return this.argument ? this.argument.raw() : '';
    }
}

module.exports = ReturnStatement;