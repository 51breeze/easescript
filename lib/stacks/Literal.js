const Stack = require("../core/Stack");
const LiteralType = require("../types/LiteralType");
const keySymbol = Symbol("key");
class Literal extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isLiteral = true;
        this[keySymbol]={};
    }
    definition( context ){
        if(this.parentStack.isImportDeclaration || 
            this.parentStack.isExportAllDeclaration || 
            this.parentStack.isExportDefaultDeclaration || 
            this.parentStack.isExportNamedDeclaration ){
            return this.parentStack.definition( this.getContext() );
        }
        // if( this.parentStack.isJSXAttribute ){
        //     return this.parentStack.definition( this.getContext(context) );
        // }
        // if( this.parentStack.isAnnotationDeclaration ){
        //     return this.parentStack.definition( this.getContext(context) );
        // }else if( this.parentStack.isJSXExpressionContainer ){
        //     return this.type().definition();
        // }
        // return this.parentStack.definition( this.getContext(context) );
        return null;
    }
    reference(){
        return this;
    }
    description(){
        return this;
    }
    referenceItems(){
        return [this];
    }
    type(){
        if( this[keySymbol]._type ){
            return this[keySymbol]._type;
        }
        let type = "string";
        const node = this.node;
        if( node.regex ){
            type= "regexp";
        }else if(node.value == node.raw){
            type= "uint";
            if( this.parentStack.isUnaryExpression ){
                type= "int";
            }else if( node.raw.includes(".") ){
                type= "float";
            }
        }else if( node.raw === "false" || node.raw === "true"){
            type = "boolean";
        }else if( node.raw === "null"){
            type = "nullable";
        }
        this[keySymbol]._type = this.getGlobalTypeById( type );
        if( !(type==="regexp" || type==="nullable") ){
            this[keySymbol]._type = new LiteralType(this[keySymbol]._type, this, this.node.value );
        }
        return this[keySymbol]._type;
    }
    value(){
        return this.node.value;
    }
    raw(){
        return this.node.raw;
    }
}

module.exports = Literal;