const Expression = require("./Expression");
const Predicate = require("../core/Predicate");
const Namespace = require("../core/Namespace");
class AssignmentExpression extends Expression{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isAssignmentExpression=true;
        this.left = this.createTokenStack( compilation, node.left, scope, node ,this);
        this.right = this.createTokenStack( compilation, node.right, scope, node ,this);
        this.left.accessor = "set";
        this.operator = node.operator;
    }
    freeze(){
        super.freeze();
        this.left.freeze();
        this.right.freeze();
    }
    definition(context){
        return this.left.definition( context );
    }
    description(){
        const desc = this.left.description();
        // if( desc && desc.isPropertyDefinition ){
        //     return desc.description();
        // }
        return desc;
    }
    getContext(){
        const desc = this.description();
        if( desc && desc.isStack ){
            return desc.getContext();
        }
        return super.getContext();
    }
    type(ctx){
        return this.right.type(ctx);
    }
     parser(){
        if(super.parser()===false)return false;
        this.left.parser();
        this.right.parser();
        this.left.setRefBeUsed();
        this.right.setRefBeUsed();
        let desc = this.description();
        if( desc && desc.isComputeType ){
            desc = this.left.type();
            this.checkExpressionType(desc, this.right, null, this.left.getContext())
        }
        else if( desc && !desc.isAnyType ){
            let identi = this.left;
            if( identi.isMemberExpression ){
                identi = identi.property;
            }

            const type = this.right.type();
            if(type && type===Namespace.globals.get('void')){
                this.left.warn(1198);
            }

            let scope = this.scope;
            if(scope && scope.allowInsertionPredicate()){
                let lType = this.left.type();
                if(!lType || (lType.isAnyType || lType.isNullableType || lType.isUndefinedType) ){
                    if(desc.isProperty && desc.computed && this.left.isMemberExpression){
                       // this.checkExpressionType(desc, this.right);
                        const origin = this.left.getFirstMemberStack().description();
                        if(origin && origin.isDeclarator){
                            const rType = this.right.type();
                            if(rType && !rType.isAnyType){
                                const existed = scope.getPredicate(origin, true);
                                if(existed){
                                    existed.setAttribute(this.left.value(), this.right)
                                }else{
                                    scope.setPredicate(origin, Predicate.attribute(this.left.value(), this.right));
                                }
                            }
                        }
                    }else if(desc.isDeclarator && !desc.acceptType){
                        const rType = this.right.type();
                        if(rType && !rType.isAnyType){
                            scope.setPredicate(desc, Predicate.create(rType, this.right.description(), desc));
                        }
                    }
                }

                if(desc && desc.isDeclarator){
                    let state = scope.getValidateState(desc);
                    if(state){
                        if(state.scope.parent === desc.scope){
                            if(state.value && state.isAlternate || !state.value && !state.isAlternate){
                                desc.whenIsNullSetValue(this.right);
                            }
                        }
                        // else{
                        //     const findParentState = (blockStack)=>{
                        //         let parentBlock = blockStack.getParentStack(stack=>stack.isBlockStatement || stack.isIfStatement || stack.isWhileStatement || stack.isConditionalExpression || stack.isFunctionExpression)
                        //         if(parentBlock){
                        //             if(parentBlock.isFunctionExpression){
                        //                 parentBlock = null;
                        //             }else if(parentBlock.isBlockStatement || parentBlock.isConditionalExpression){
                        //                 parentBlock = parentBlock.parentStack
                        //             }
                        //         }
                        //         if(parentBlock){
                        //             let isNested = !!(parentBlock.isIfStatement || parentBlock.isConditionalExpression || parentBlock.isWhileStatement)
                        //             if(isNested){
                        //                 let parentState = parentBlock.scope.getValidateState(desc);
                        //                 if(parentState){
                        //                     if(parentState.scope.parent === desc.scope){

                        //                         return true
                        //                     }else{
                        //                         return findParentState(parentState.stack)
                        //                     }
                        //                 }else{
                        //                     return false;
                        //                 }
                        //             }
                        //         }
                        //         return false;
                        //     }
                        //     if(findParentState(state.stack)){
                        //         desc.whenIsNullSetValue(this.right);
                        //     }
                        // }
                    }
                }
            }

            if( this.left.isArrayPattern || this.left.isObjectPattern){

                //todo...

            }else{

                if( desc.kind ==="const" || !desc.assignment ){
                    if( desc.isTypeObjectPropertyDefinition ){
                        this.checkExpressionType(desc, this.right, identi, this.left.getContext());
                    }else{
                        if( !this.left.isMemberExpression ){
                            this.error(1015,this.left.value());
                        }
                    }
                }else{
                    desc.assignment(this.right, identi, this.left.getContext());
                }
            }
        }
    }
    value(){
        return this.left.value();
    }
}

module.exports = AssignmentExpression;