const FunctionExpression = require("./FunctionExpression");
class DeclaratorFunction extends FunctionExpression{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isDeclaratorFunction= true;
        this.key = this.createTokenStack(compilation,node.id,scope,node,this);
        this.modifier = this.createTokenStack(compilation,node.modifier,scope,node,this);
        this.namespace.set(this.key.value(),this)
        this._annotations = [];
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

    freeze(){
        super.freeze();
        this.key.freeze();
    }

    value(){
        return this.key.value();
    }

    parser(){
        if(super.parser()===false)return false;
        const name = this.key.value();
        if(!this.namespace.checkDescriptors(name, this) ){
            this.key.error(1096,name);
        }
    }
}
module.exports = DeclaratorFunction;