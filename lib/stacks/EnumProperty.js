const Stack = require("../core/Stack");
const EnumType = require("../types/EnumType");
class EnumProperty extends Stack{

    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isEnumProperty= true;
        this.key = this.createTokenStack(compilation,node.key,scope,node,this);
        let init = node.init;
        if(!init){
            if( typeof parentStack.increment ==='string' ){
                this.key.error(1153, this.key.value() )
            }else{
                init = Object.assign({},node);
                init.type  = "Literal";
                init.value = parentStack.increment++;
                init.raw = `${init.value}`;
            }
        }
        this.init = this.createTokenStack(compilation,init,scope,node,this);
        this.callableStatic = true;
    }
    freeze(){
        super.freeze(this);
        super.freeze(this.init);
        super.freeze(this.key);
    }
    definition(){
        const expre = `(enum member) ${this.parentStack.value()}.${this.value()}=${this.init.value()}`;
        return {
            kind:"enum",
            comments:this.comments,
            identifier:this.value(),
            expre:expre,
            location:this.getLocation(),
            file:this.compilation.file,
            context:this
        };
    }
    reference(){
        return this;
    }
    referenceItems(){
        return [this];
    }
    description(){
        return this;
    }
    type(){
        return this._type || (this._type = new EnumType( typeof this.init.value() === 'string' ? this.getGlobalTypeById("String") : this.getGlobalTypeById("Number"),this,this.parentStack.type()));
    }
    raw(){
        return this.key.raw();
    }
    value(){
        return this.key.value();
    }
}

module.exports = EnumProperty;