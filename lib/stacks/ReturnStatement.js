const Namespace = require("../core/Namespace");
const Stack = require("../core/Stack");
const Utils = require("../core/Utils");
const keySymbol = Symbol('key');
const Predicate = require("../core/Predicate");
class ReturnStatement extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isReturnStatement= true;
        this.hasReturnStatement = true;
        this.argument = this.createTokenStack( compilation, node.argument, scope, node,this );
        const fnScope = scope.getScopeByType("function");
        this.returnIndex = fnScope.returnItems.length;
        if( this.argument ){
            fnScope.returnItems.push( this );
        }
        this[keySymbol]={};
        this.fnScope = fnScope;
        if(parentStack){
            let statement = parentStack.isBlockStatement ? parentStack.parentStack : parentStack;
            if(statement){
                if(statement.isIfStatement || statement.isTryStatement){
                    parentStack.hasReturnStatement = true;
                }else if(statement.isSwitchCase){
                    statement.hasReturnStatement = true;
                }
            }
        }
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

        let pp = this.parentStack;
        if(pp.isBlockStatement)pp = pp.parentStack;
        if(pp.isIfStatement){
            let fp = pp.parentStack;
            if(fp.isBlockStatement)fp = fp.parentStack;
            if(fp.isFunctionExpression){
                const condition = pp.condition;
                this.getConditions(condition).forEach((stack)=>{

                    let value = true;
                    if(stack.isUnaryExpression){
                        if(stack.isLogicalFlag){
                            value = stack.isLogicalTrueFlag;
                        }
                        stack = stack.argument;
                        if(stack.isParenthesizedExpression){
                            stack=stack.expression;
                        }
                    }

                    if(stack.isBinaryExpression && stack.isIsOperatorFlag && value === false){
                        const lDesc = stack.left.description();
                        this.scope.parent.setPredicate(lDesc, Predicate.create(stack.right.type(), stack.right.description(), lDesc));
                        stack = stack.left;
                    }

                    if(!(stack.isIdentifier || stack.isMemberExpression))return;
                    if(stack.parentStack.isLogicalExpression && stack.isAndOperator){
                        return;
                    }

                    const desc = stack.description();
                    if(desc){
                        const state = this.scope.getValidateState(desc);
                        if(state && state.value === false && condition.scope === state.scope){
                            this.scope.parent.setValidateState(desc, pp, true, condition);
                        }
                    }
                })
            }
        }

        let parent = this.getParentFunction();
        if( !parent || !parent.isFunctionExpression){
            return this.error(1072);
        }

        if( this.argument ){
            this.argument.parser();
            this.argument.setRefBeUsed();

            const rType = this.argument.type();
            if( rType && (rType.isNullableType || rType.isVoidType)){
                return true;
            }

            if(parent && parent.async){
                let returnType = parent.getReturnedType();
                const origin = Utils.getOriginType(returnType);
                const PromiseType = Namespace.globals.get('Promise');
                if(origin && PromiseType.is(origin)){
                    let acceptType = null;
                    if( returnType.isInstanceofType && returnType.generics[0] ){
                        acceptType = returnType.generics[0].type();
                    }else if( returnType.isClassGenericType  && returnType.types[0] ){
                        acceptType = returnType.types[0].type();
                    }
                    if(acceptType && !acceptType.isGenericType){
                        this.checkExpressionType(acceptType, this.argument);
                    }
                    return true;
                }
            }

            let returnType = parent && parent.returnType;
            if( returnType && !returnType.isGenericType ){
                this.checkExpressionType(returnType, this.argument);
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