const Stack = require("../core/Stack");
class TypeStatement extends Stack {
    constructor(compilation,node,scope,parentNode,parentStack){ 
        super(compilation,node,scope,parentNode,parentStack);
        this.isTypeStatement= true;
        this.id = this.createTokenStack( compilation,node.id, scope, node, this);
        this.init = this.createTokenStack( compilation, node.init, scope, node, this);
        if( this.scope.isDefine(this.id.value()) ){
            this.id.error(1078, this.id.value() );
        }else if( this.getTypeById( this.id.value() ) ){
            this.id.error(1078, this.id.value() );
        }else{
            this.scope.define(this.id.value(), this);
        }
    }

    freeze(){
        super.freeze();
        this.id.freeze();
        this.init.freeze();
    }

    type(){
        return this.init.type();
    }

    setRefBeUsed(){}

    definition( ctx ){
        ctx = ctx || this.getContext();
        let type = this.init.type();
        let typeStr = type.toString(ctx);
        const identifier = this.id.value();
        const expre = `(type) ${identifier} = ${typeStr}`;
        return {
            comments:this.comments,
            expre:expre,
            location:this.id.getLocation(),
            file:this.compilation.file,
        };
    }

    parser(){ 
        return this.init.parser();
    }

    value(){
        return this.id.value();
    }

    raw(){
        return this.id.raw();
    }
}

module.exports = TypeStatement;