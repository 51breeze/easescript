const Namespace = require("./Namespace");
const TyperFlag = Symbol('TyperInstanceof')
class Typer{
    static is(type){
        return type ? type[TyperFlag] : false;
    }

    [TyperFlag] = true;
    constructor(type, stack, context=null){
        this.type = type;
        this.stack = stack;
        this.context = context;
        this.isType = true;
    }

    getContext(){
        return this.context || this.stack.getContext();
    }

    get origin(){
        return this.type;
    }

    type(){
        let type = this.origin;
        let ctx = this.getContext();
        if(type.isComputeType){
            const object = ctx.fetch(this.object.type(), true);
            const property = ctx.fetch(this.property.type(), true);
            if(object && property && !(object.isGenericType || property.isGenericType)){
                type = type.getComputeValue(object, property);
                if(type)return type;
            }
            return Namespace.globals.get('any');
        }
        return ctx.fetch(type, true);
    }

    check(type, context, options={}, whenErrorCallback=null){
        if(!type)return false;
        return this.type().check(type.type(), context, options);
    }

    is(type, context, options={}){
        if(!type)return false;
        return this.type().is(type.type(), context, options);
    }
}

module.exports = Typer;