const Stack = require("../core/Stack");
class TemplateLiteral extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.expressions = node.expressions.map( item=>this.createTokenStack(compilation,item,scope,node,this) );
        this.quasis = node.quasis.map( item=>this.createTokenStack(compilation,item,scope,node,this) );
        this.isTemplateLiteral = true;
    }
    freeze(){
        super.freeze();
        super.freeze( this.quasis );
        super.freeze( this.expressions );
        this.quasis.forEach( stack=>stack.freeze() );
        this.expressions.forEach( stack=>stack.freeze() );
    }
    definition(){
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
        return this.getModuleById( 'string' );
    }
    value(){
        return this.node.raw;
    }
    raw(){
        return this.node.raw;
    }
    parser(){
        if(super.parser()===false)return false;
        this.expressions.forEach(item=>{
            item.parser();
            item.setRefBeUsed();
        });
    }
}

module.exports = TemplateLiteral;