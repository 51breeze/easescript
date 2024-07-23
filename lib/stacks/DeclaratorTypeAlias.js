const Stack = require("../core/Stack");
const AnyType = require("../types/AnyType");
const VoidType = require("../types/VoidType");
const AliasType = require("../types/AliasType");
const NullableType = require("../types/NullableType");
const UndefinedType = require("../types/UndefinedType");
const NeverType = require("../types/NeverType");
const BlockScope = require("../scope/BlockScope");
const Utils = require("../core/Utils");
class DeclaratorTypeAlias extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        scope = new BlockScope(scope);
        super(compilation,node,scope,parentNode,parentStack);
        this.isDeclaratorTypeAlias= true;
        this.left = this.createTokenStack(compilation,node.left,scope,node,this);
        this.right = this.createTokenStack(compilation,node.right,scope,node,this);
        this.genericity = this.createTokenStack(compilation,node.genericity,scope,node,this);
        this.modifier = this.createTokenStack(compilation,node.modifier,scope,node,this);
        this.kind = node.kind;
        if(node.kind==='declare'){
            if(!this.module){
                this.namespace.set(this.left.value(), this);
            }
        }
        scope.parent.define(this.left.value(), this);
    }

    set imports( items ){
        if( Array.isArray(items)){
            items.forEach( item=>{
                if( item.isImportDeclaration ){
                    item.additional = this;
                }
            });
            this._imports = items;
        }
    }

    get imports(){
        return this._imports;
    }

    freeze(){
        super.freeze(this);
        this.left.freeze();
        this.right.freeze();
    }

    definition(ctx){
        let complete = ctx ? false : true;
        if( ctx && ctx.stack){
            if( ctx.stack === this.left ){
                complete = true;
            }
        }
        const declareGenerics = this.genericity ? this.genericity.elements : [];
        const generics = declareGenerics.length > 0 ? '<'+(declareGenerics.map( decl=>decl.type().toString(ctx, {complete}) ).join(', '))+'>' : '';
        if(Utils.isGlobalShortenType(this.type())){
            return {
                comments:this.comments,
                kind:'type',
                expre:`type ${this.left.value()}${generics}`,
            };
        }

        return {
            comments:this.comments,
            kind:'type',
            expre:`type ${this.left.value()}${generics}`,
            location:this.left.getLocation(),
            file:this.file,
        };
    }
    set metatypes(value){
        this._metatypes = value;
    }
    get metatypes(){
       return this._metatypes;
    }
    set annotations(value){
        this._annotations = value;
    }
    get annotations(){
        return this._annotations;
    }
    get id(){
        return this.left.value();
    }
    get key(){
        return this.left;
    }
    reference(){
        return this.right.reference();
    }
    referenceItems(){
        return this.right.referenceItems();
    }
    description(){
        return this
    }
    type(){
        return this.getAttribute('type',()=>{
            const value = this.right.value();
            switch( value ){
                case 'any' :
                    return this._type = new AnyType()
                case 'nullable' :
                    return this._type = new NullableType();
                case 'void' :
                    return this._type = new VoidType();
                case 'never' :
                    return this._type = new NeverType();
                case 'undefined' :
                    return this._type = new UndefinedType();
            }
            return new AliasType(this.right.type(), this);
        });
    }
    
    parser(){
        if(super.parser()===false)return false;
        if( this.genericity ){
            this.genericity.parser();
        }
        this.right.parser();
    }
    error(code,...args){
        this.left.error(code,...args)
    }
    warn(code,...args){
        this.left.warn(code,...args)
    }
    value(){
        return this.left.value();
    }
    raw(){
        return this.left.raw();
    }
}
module.exports = DeclaratorTypeAlias;