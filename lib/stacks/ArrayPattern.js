const Namespace = require("../core/Namespace");
const Stack = require("../core/Stack");
const Utils = require("../core/Utils");
const TupleType = require("../types/TupleType");
const Declarator = require("./Declarator");
class ArrayPattern extends Stack {
    constructor(compilation,node,scope,parentNode,parentStack){ 
        super(compilation,node,scope,parentNode,parentStack);
        this.isArrayPattern=true;
        this.elements = node.elements.map( item=>{
            let stack = null;
            if(item && item.type ==="Identifier"){
                if(this.parentStack.isVariableDeclarator || this.parentStack.isFunctionExpression){
                    stack = new Declarator(compilation, item, scope, node,this);
                    const context = parentStack.parentStack.kind ==="var" ? 'function' : 'block';
                    const name = stack.value();
                    if( scope.isDefine( name , context ) ){
                        this.error(1007, name);
                    }
                    scope.define( name, stack );
                }else{
                    stack = this.createTokenStack( compilation, item, scope, node,this);
                }
            }else if(item){
               stack = this.createTokenStack( compilation, item, scope, node,this);
            }
            return stack;
        });
        if( node.acceptType ){
           this._acceptType = this.createTokenStack( compilation, node.acceptType, scope, node, this);
        }
    }
    get acceptType(){
        if(this.parentStack.isVariableDeclarator){
            return this.parentStack._acceptType;
        }
        return this._acceptType;
    }

    type(){
        let acceptType = this.acceptType;
        if(acceptType){
            return acceptType.type();
        }else{
            return this.getAttribute('type',()=>{
                return new TupleType(Namespace.globals.get('array'), this.elements, this);
            })
        }
    }

    freeze(){
        super.freeze(this);
        super.freeze(this.elements);
        this.elements.forEach(stack=>stack.freeze());
    }
    definition(){
        return null;
    }

    setKind(value){
        this.elements.forEach( item=>{
            item.kind=value;
        });
    }

    parser(){
        if(super.parser()===false)return false;
        const init = this.parentStack.init;
        const is   = init && init.isArrayExpression;
        const refs = init && init.type();
        const arrayType = Namespace.globals.get("array");
        const iteratorType = Namespace.globals.get("Iterator");
        if(init)init.parser();
        if( init && !(arrayType.check(refs) || iteratorType.check(refs) ) ){
            init.error(1012, init.raw(), refs.toString());
        }
        this.elements.forEach((item,index)=>{
            item.parser();
            const desc = item.description();
            const defaultValue = item.isAssignmentPattern ? true : false;
            if( desc ){
                if( item.isRestElement ){
                    if( refs ){
                        desc.assignment(refs, item);
                    }
                    return;
                }
                if( is ){
                    const value = init.attribute( index );
                    if(!defaultValue && !value ){
                        item.error(1014,init.raw(),index);
                    }
                    if( value ){
                        desc.assignment(value, item);
                    }else if(item.right){
                        desc.assignment(item.right, item);
                    }
                }else{
                    let value = Utils.extractArrayPatternItem(refs, index);
                    if( value ){
                        desc.assignment(value, item);
                    }else if(item.right){
                        desc.assignment(item.right, item);
                    }else if( refs && ((refs.isTupleType && !refs.prefix) || refs.isLiteralArrayType)){
                        const elements = refs.isTupleType && refs.target && refs.target.isArrayExpression ? refs.target.elements : refs.elements;
                        if(elements.length > 0 && !elements[0].type().isUnionType){
                            item.error(1014,init.raw(),index);
                        }
                    }
                }
            }
        }) 
    }

    value(){
       return this.elements.map(item=>{
           return item.value()
       }).join(",")
    }
}

module.exports = ArrayPattern;