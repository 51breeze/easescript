const JSModule = require("../core/JSModule");
const Stack = require("../core/Stack");
class DeclaratorVariable extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isDeclaratorVariable= true;
        this.modifier = this.createTokenStack(compilation,node.modifier,scope,node,this);
        this.declarations = node.expression.declarations.map((item)=>this.createTokenStack(compilation,item,scope,node,this));
        if(!(parentStack && parentStack.isModuleDeclaration) && !JSModule.is(parentStack.module)){
            this.declarations.forEach( item=>{
                this.namespace.set(item.id.value(), this)
            });
        }
        this._annotations = [];
        scope.define(this.value(), this);
    }

    parser(){
        if(super.parser()===false)return false;   
        this.declarations.forEach( item=>{
            item.parser();
            if( this.namespace && !JSModule.is(this.module) && !this.namespace.checkDescriptors(item.id.value(), this) ){
                item.id.error(1097,item.id.value());
            }
        });
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
        super.freeze(this.declarations);
        this.declarations.forEach( stack=>stack.freeze() )
    }
    definition( context ){
        const kind = this.declarations[0].kind;
        const type = this.declarations[0].type().toString(context);
        const id = this.declarations[0].id;
        const token = id.value();
        return {
            comments:this.comments,
            kind,
            expre: `(global ${kind}) ${token}:${type}`,
            location:id.getLocation(),
            file:id.compilation.file,
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
        value.forEach( (annotation)=>{
            annotation.additional = this;
        });
    }

    get annotations(){
        return this._annotations;
    }
    get kind(){
        return this.declarations[0].kind;
    }
    get init(){
        return this.declarations[0].init;
    }
    get key(){
        return this.declarations[0].id;
    }
    get id(){
        return this.declarations[0].value();
    }
    get acceptType(){
        return this.declarations[0].acceptType;
    }
    get assignItems(){
        return this.declarations[0].assignItems;
    }
    reference(){
        return this.declarations[0].reference();
    }
    referenceItems(){
        return this.declarations[0].referenceItems();
    }
    description(){
        return this;
    }
    type(){
        return this.getAttribute('type',()=>{
            return this.declarations[0].type();
        });
    }
    error(code,...args){
        this.declarations[0].error(code,...args)
    }
    warn(code,...args){
        this.declarations[0].warn(code,...args)
    }
    value(){
        return this.declarations[0].value();
    }
    raw(){
        return this.declarations[0].raw();
    }
}
module.exports = DeclaratorVariable;