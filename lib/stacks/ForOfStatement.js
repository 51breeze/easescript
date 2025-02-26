const Context = require("../core/Context");
const MergeType = require("../core/MergeType");
const Namespace = require("../core/Namespace");
const Stack = require("../core/Stack");
const Utils = require("../core/Utils");
const Inference = require("../core/Inference");
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
        return this.getAttribute('forOfType',()=>{
            let rightType = this.right.type();
            let ctx = Inference.create(null, this.right.getContext(), rightType);
            let valueType = Namespace.globals.get("any");
            if(rightType && !rightType.isAnyType){
                if( rightType.isLiteralArrayType || rightType.isUnionType || rightType.isLiteralObjectType){
                    valueType = MergeType.to( rightType, !!(rightType.isLiteralArrayType||rightType.isLiteralObjectType) );
                }else if(rightType.isTupleType){
                    if(rightType.elements.length==1 && rightType.prefix){
                        valueType = rightType.elements[0].type();
                    }else{
                        valueType = MergeType.to( rightType, true );
                    }
                }else if( rightType.isLiteralType ){
                    valueType = Namespace.globals.get("string");
                }else{
                    const iterator = Namespace.globals.get("Iterator");
                    const origin = Utils.getOriginType( rightType );
                    if(Utils.isModule(origin) && origin.is(iterator)){
                        let IteratorReturnResult = Namespace.globals.get('IteratorReturnResult');
                        let result = null;
                        let declareGenerics = iterator.getModuleGenerics();
                        if(declareGenerics){
                            const res = ctx.fetch(declareGenerics[0]);
                            if(res){
                                result = res.type()
                            }
                        }
                        if(!result){
                            const desc = origin.getDescriptor('next', (desc,prev)=>{
                                if(desc.isMethodDefinition){
                                    const result = desc.getReturnedType();
                                    if(result && IteratorReturnResult.is(result.type(), ctx)){
                                        return true;
                                    }
                                }
                                return null;
                            });
                            if(desc){
                                ctx.append(desc.getReturnedType())
                                let declareGenerics = IteratorReturnResult.getModuleGenerics();
                                if(declareGenerics){
                                    const res = ctx.fetch(declareGenerics[0]);
                                    if(res){
                                        result = res.type()
                                    }
                                }
                            }
                        } 
                        if(result){
                            valueType = result;
                        }
                    }
                }
            }
            return valueType;
        })
    }

    parser(){
        if(super.parser()===false)return false;
        this.left.parser();
        this.left.setRefBeUsed();
        this.right.parser();
        this.right.setRefBeUsed();
        if(this.body){
            this.body.parser();
        }
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
    }
}

module.exports = ForOfStatement;