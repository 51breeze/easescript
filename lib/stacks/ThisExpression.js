const Expression = require("./Expression");
class ThisExpression  extends Expression {
    constructor(compilation,node,scope,parentNode,parentStack){ 
        super(compilation,node,scope,parentNode,parentStack);
        this.isThisExpression= true;
    }
    definition(){
        const identifier = this.value();
        const context = this;
        return {
            kind:"this",
            identifier:identifier,
            expre:`this: this`,
            location:this.getLocation(),
            file:this.compilation.file,
            context
        };
    }
    getContext(){
        return this.getAttribute('getContext', ()=>{
            const module = this.module;
            if( module ){
                const moduleStack = module.moduleStack;
                const parent = moduleStack.getContext();
                return parent.createChild(this);
            }
            return super.getContext()
        }); 
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
        return this.scope.define( this.value() );
    }
    value(){
        return `this`;
    }
    raw(){
        return `this`; 
    }
    async parser(){
        return await this.callParser(async ()=>{
            const desc = this.type();
            if( !desc ){
                this.error(1013,this.raw());
            }
        })
    }
}

module.exports = ThisExpression;