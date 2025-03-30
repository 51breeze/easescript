const Namespace = require("../core/Namespace");
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
    hover(){
        if(this.parentStack.isImportDeclaration || 
            this.parentStack.isExportAllDeclaration || 
            this.parentStack.isExportDefaultDeclaration || 
            this.parentStack.isExportNamedDeclaration ){
            return this.parentStack.hover(this.getContext());
        }
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
    getTypeName(){
        const node = this.node;
        let type = "string";
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
        }else if( node.raw === "undefined"){
            type = "undefined";
        }
        return type;
    }
    type(){
        return this.getAttribute('type',()=>{
            let type = this.getTypeName();
            let final = Namespace.globals.get(type);
            if( !(type==="regexp" || type==="nullable") ){
                return new LiteralType(final, this.parentStack.isTypeDefinition ? this.parentStack : this, this.node.value);
            }
            return final;
        });
    }
    value(){
        return this.node.value;
    }
    raw(){
        return this.node.raw;
    }
}

module.exports = Literal;