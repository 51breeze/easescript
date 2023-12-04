const Stack = require("../core/Stack");
const AnyType = require("../types/AnyType");
const VoidType = require("../types/VoidType");
const AliasType = require("../types/AliasType");
const NullableType = require("../types/NullableType");
const NeverType = require("../types/NeverType");
const BlockScope = require("../scope/BlockScope");
class DeclaratorTypeAlias extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        scope = new BlockScope(scope);
        super(compilation,node,scope,parentNode,parentStack);
        this.isDeclaratorTypeAlias= true;
        this.left = this.createTokenStack(compilation,node.left,scope,node,this);
        this.right = this.createTokenStack(compilation,node.right,scope,node,this);
        this.genericity = this.createTokenStack(compilation,node.genericity,scope,node,this);
        this.modifier = this.createTokenStack(compilation,node.modifier,scope,node,this);
        this.namespace.set(this.left.value(), this);
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
        if( complete ){
            return {
                comments:this.comments,
                expre:`(type) ${this.left.value()}${generics}`,
            };
        }
        return {
            comments:this.comments,
            expre:`(type) ${this.left.value()}${generics}`,
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
    reference(){
        return this.right.reference();
    }
    referenceItems(){
        return this.right.referenceItems();
    }
    description(){
        return this.right.description();
    }
    type(ctx){
        if( this._type )return this._type;
        const value = this.right.value();
        switch( value ){
            case 'any' :
                return this._type = new AnyType(value);
            case 'nullable' :
                return this._type = new NullableType(value)
            case 'void' :
                return this._type = new VoidType(value)
            case 'never' :
                return this._type = new NeverType(value)
        }
        this._type = new AliasType(this.right.type(ctx), this);
        this._type.mtime = this.compilation.mtime;
        this._type.compilation = this.compilation;
        return this._type;
    }
    parser(){
        if(!super.parser())return false;
        if( this.genericity ){
            this.genericity.parser();
            const ctx = this.getContext();
            ctx.declareGenerics(this.genericity);
        }
        this.right.parser();
        return true;
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