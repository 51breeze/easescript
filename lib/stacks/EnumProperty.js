const Stack = require("../core/Stack");
const Utils = require("../core/Utils");
const EnumType = require("../types/EnumType");
class EnumProperty extends Stack{

    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isEnumProperty= true;
        this.key = this.createTokenStack(compilation,node.key,scope,node,this);
        let init = node.init;
        this.hasInit = !!init;
        if(!init){
            init = Object.assign({},node);
            init.type  = "Literal";
            init.value = Utils.incrementCharacter(parentStack.increment) || parentStack.increment;
            if(typeof init.value ==='number'){
                init.raw = `${init.value}`;
            }else{
                init.raw = `"${init.value}"`;
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
        const expre = `(enum property) ${this.parentStack.value()}.${this.value()} = ${this.init.raw()}`;
        return {
            kind:"enum",
            comments:this.comments,
            expre:expre,
            location:this.getLocation(),
            file:this.compilation.file,
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
        return this.getAttribute('type',()=>{
            return new EnumType(this.init.type(),this,this.parentStack.type())
        })
    }
    raw(){
        return this.key.raw();
    }
    value(){
        return this.key.value();
    }
}

module.exports = EnumProperty;