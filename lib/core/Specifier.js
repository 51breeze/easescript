class Specifier{

    constructor(stack, context){
        this.stack = stack;
        this.context = context;
        this.type = null;
    }

    getContext(){
        let ctx = this.context
        if(ctx)return ctx;
        return this.context = stack.getContext()
    }

    setType(value){
        if(value){
            this.type = value;
        }
    }

    getType(){
        let type = this.type;
        if(type)return type;
        type = this.stack.type();
        return this.type = type;
    }

}

module.exports = Specifier;