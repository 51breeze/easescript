const Stack = require("../core/Stack");
const AliasType = require("../types/AliasType");
class TypeObjectPropertyDefinition extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isTypeObjectPropertyDefinition= true;
        this.key = this.createTokenStack( compilation, node.key,scope, node,this );
        this.key.acceptType = this.createTokenStack(compilation, node.key.acceptType, scope, node,this );
        this.dynamic = !!node.key.computed;
        this.init = this.createTokenStack( compilation, node.value,scope, node,this );
        this.question = !!node.key.question;
        this.isProperty= true;
    }
    freeze(){
        super.freeze();
        this.key.freeze();
        this.init.freeze();
    }
    get acceptType(){
        const acceptType = this.key.acceptType ? this.key.acceptType.type() : this.getGlobalTypeById('string') ;
        return acceptType;
    }
    definition(ctx){
        const question = this.question ? '?' : '';
        let key =  this.key.value()
        if( this.dynamic ){
            key = `[${key}:${this.acceptType.toString(ctx)}]`
        }
        ctx = ctx || this.getContext();
        return {
            comments:this.parentStack.comments,
            expre:`(property) ${key}${question}:${this.type().toString(ctx)}`,
            location:this.key.getLocation(),
            file:this.compilation.file,
        };
    }
    value(){
        return this.key.value();
    }
    description(){
        return this;
    }
    setRefBeUsed(){}
    type(){
        return this.getAttribute('type',()=>{
            if( this.parentStack.parentStack.isTypeStatement && this.init && this.init.isTypeDefinition && this.init.argument ){
                if( this.parentStack.parentStack === this.init.argument.description() ){
                    return new AliasType(this.parentStack.parentStack.type(), this.parentStack.parentStack);
                }
            }
            if( this.init ){
                return this.init.type();
            }
            return this.getGlobalTypeById('any');
        })
    }
    assignment(value){
        if( this.init ){
            this.checkExpressionType(this.init.type(), value);
        }
    }
    parser(){
        if(super.parser()===false)return false;
        if( this.dynamic ){
            this.key.acceptType && this.key.acceptType.parser();
            const acceptType = this.key.acceptType ? this.key.acceptType.type() : this.getGlobalTypeById('string') ;
            const result = acceptType && ['string','number'].some( type=>acceptType.check( this.getGlobalTypeById(type) ) )
            if( !result ){
                this.key.error(1139, this.key.value() );
            }
        }
        if( this.init ){
            if( this.parentStack.parentStack.isTypeStatement && this.init.isTypeDefinition && this.init.argument ){
                if( this.parentStack.parentStack === this.init.argument.description() ){
                    return true;
                }
            }
            this.init.parser();
        }else{
            
        }
    }
    error(code,...args){
        this.key.error(code,...args);
    }
    warn(code,...args){
        this.key.warn(code,...args);
    }
}

module.exports = TypeObjectPropertyDefinition;