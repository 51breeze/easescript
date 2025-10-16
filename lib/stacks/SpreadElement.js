const MergeType = require("../core/MergeType");
const Namespace = require("../core/Namespace");
const Stack = require("../core/Stack");
const LiteralObjectType = require("../types/LiteralObjectType");
class SpreadElement  extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isSpreadElement=true;
        this.argument = this.createTokenStack( compilation, node.argument, scope, node, this );
    }
    freeze(){
        super.freeze();
        this.argument.freeze();
    }
    definition(ctx){
        return this.argument.definition(ctx);
    }
    description(){
        return this.argument.description();
    }
    reference(){
        return this.argument.reference();
    }
    referenceItems(){
        return this.argument.referenceItems();
    }
    key(){
        return this.argument.key();
    }
    getContext(){
        return this.argument.getContext();
    }
    type(){
        return this.getAttribute('type', ()=>{
            const type = this.argument.type();
            if(this.parentStack.isArrayExpression){
                if(type.isTupleType || type.isLiteralArrayType){
                    return MergeType.arrayToUnion(type.elements);
                }else{
                    const iterator = Namespace.globals.get("Iterator");
                    if(type.is(iterator)){
                        let declareGenerics = iterator.getModuleGenerics();
                        if(declareGenerics && declareGenerics[0]){
                            const ctx = this.getContext();
                            const res = ctx.fetch(declareGenerics[0].type());
                            if(res){
                                return res;
                            }
                        }
                    }
                }
                return Namespace.globals.get("any");
            }
            return type;
        });
    }
    parser(){
        if(super.parser()===false)return false;
        this.argument.parser();
        this.argument.setRefBeUsed();
        const type = this.argument.type();
        if( this.parentStack.isArrayExpression || this.parentStack.isCallExpression || this.parentStack.isNewExpression){
            const arrayType = Namespace.globals.get("array");
            const iteratorType = Namespace.globals.get("Iterator");
            if(!(arrayType.is(type) || iteratorType.is(type))){
                this.error(1073,this.argument.value())
            }  
        }else if( this.parentStack.isObjectExpression ){
            const objectType = Namespace.globals.get("object");
            if( !objectType.is(type) ){
                this.error(1074,this.argument.value())
            }
        }
    }
    value(){
        return this.argument.value();
    }
    raw(){
        return this.argument.raw();
    }
    error(code,...args){
        this.argument.error(code,...args);
    }
    warn( code,...args ){
        this.argument.warn(code,...args);
    }
}

module.exports = SpreadElement;