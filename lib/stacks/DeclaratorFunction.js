const FunctionExpression = require("./FunctionExpression");
class DeclaratorFunction extends FunctionExpression{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isDeclaratorFunction= true;
        this.key = this.createTokenStack(compilation,node.id,scope,node,this);
        this.modifier = this.createTokenStack(compilation,node.modifier,scope,node,this);
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
        super.freeze();
        this.key.freeze();
    }

    async createCompleted(){
        const name = this.key.value();
        if( !this.namespace.set(name,this) ){
            this.key.error(1096,name);
        }
    }

}
module.exports = DeclaratorFunction;