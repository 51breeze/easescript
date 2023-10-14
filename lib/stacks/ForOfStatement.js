const Context = require("../core/Context");
const MergeType = require("../core/MergeType");
const Stack = require("../core/Stack");
const Utils = require("../core/Utils");
const BlockScope = require("../scope/BlockScope");
class ForOfStatement extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        scope = new BlockScope(scope);
        super(compilation,node,scope,parentNode,parentStack);
        this.isForOfStatement= true;
        this.left  = this.createTokenStack(compilation,node.left,scope,node,this);
        this.right = this.createTokenStack(compilation,node.right,scope,node,this);
        this.body  = this.createTokenStack(compilation,node.body,scope,node,this);
    }
    freeze(){
        super.freeze();
        this.left.freeze();
        this.right.freeze();
        this.body.freeze();
    }
    definition(){
        return null;
    }

    forOfType(){
        const t = this.getAttribute('forOfType');
        if(t)return t;

        const ctx = this.right.getContext();
        let rightType = this.right.type();
        ctx.make( rightType );
        let valueType = this.getGlobalTypeById("any");
        if( rightType && !rightType.isAnyType ){
            if( rightType.isLiteralArrayType || rightType.isUnionType || rightType.isLiteralObjectType){
                valueType = MergeType.to( rightType, !!(rightType.isLiteralArrayType||rightType.isLiteralObjectType) );
            }else if(rightType.isTupleType){
                if( rightType.elements.length==1 ){
                    valueType = rightType.elements[0].type();
                }else{
                    valueType = MergeType.to( rightType, true );
                }
            }else if( rightType.isLiteralType ){
                valueType = this.getGlobalTypeById("string");
            }else{
                const iterator = this.getGlobalTypeById("Iterator");
                const originType = Utils.getOriginType( rightType );
                const IteratorReturnResult = this.getGlobalTypeById('IteratorReturnResult');
                if( originType.isModule && originType.is(iterator) ){

                    let result = null;
                    let declareGenerics = iterator.getModuleGenerics();
                    if( declareGenerics ){
                        const res = ctx.fetch(declareGenerics[0]);
                        if( res && !res.isUnknownType ){
                            result = res.type()
                        }
                    }

                    if( !result ){
                        const desc = originType.getDescriptor('next', (desc,prev)=>{
                            if(desc.isMethodDefinition){
                                const result = desc.inferReturnType();
                                if( result ){
                                    if(IteratorReturnResult.is(result.type(), ctx)){
                                        return true;
                                    }
                                }
                            }
                            return null;
                        });

                        if( desc ){
                            const resultCtx = new Context(this.right);
                            const returnType =  desc._returnType
                            if( returnType ){
                                resultCtx.make(returnType.type());
                            }else{
                                let inferType = desc.inferReturnType();
                                if( inferType ){
                                    resultCtx.extractive(IteratorReturnResult, inferType.type());
                                }
                            }

                            declareGenerics = IteratorReturnResult.getModuleGenerics();
                            if(declareGenerics){
                                const res = resultCtx.fetch(declareGenerics[0]);
                                if( res && !res.isUnknownType){
                                    result = res.type()
                                }
                            }
                        }
                    } 

                    if( result ){
                        valueType = result;
                    }
                }

            }
        }
        return this.setAttribute('forOfType',valueType);
    }

    parser(){
        if( !super.parser() )return false;
        this.left.parser();
        this.left.setRefBeUsed();
        this.right.parser();
        this.right.setRefBeUsed();
        this.body && this.body.parser();
        const iterator = this.getGlobalTypeById("Iterator");
        const type = Utils.getOriginType( this.right.type() );
        if( this.left.isVariableDeclaration ){
            if( this.left.declarations.length > 1 ){
                this.left.declarations[1].error(1047,'for-of');
            }
            if( this.left.declarations[0].init ){
                this.left.declarations[0].init.error(1048,'for-of');
            }
        }
        
        if( type && !type.isAnyType && !type.is(iterator) ){
            this.right.error(1049,this.right.raw());
        }
        return true;
    }
}

module.exports = ForOfStatement;