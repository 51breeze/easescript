const Namespace = require("../core/Namespace");
const MethodDefinition = require("./MethodDefinition");
class MethodGetterDefinition extends MethodDefinition{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isMethodGetterDefinition= true;
        this.callable = false
        this.isAccessor = true;
    }
    definition( ctx ){

        let complete  = false;
        if( !ctx || (ctx.stack && (ctx.stack === this.key || ctx.stack === this))){
            complete = true;
            ctx = {}
        }

        const type = this.type();
        const identifier = this.key.value();
        const context = this;
        const modifier = this.modifier ? this.modifier.value() : "public";
        let owner = this.module.getName();
        const _static = this.static ? 'static ' : '';
        const declareGenerics = this.module.getModuleGenerics();
        if( declareGenerics ){
            owner = [owner,'<',declareGenerics.map( type=>type.toString(ctx,{complete}) ).join(", "),'>'].join("")
        }

        return {
            comments:context.comments,
            expre:`(propery) ${_static}${modifier} get ${owner}.${identifier}(): ${type.toString(ctx)}`,
            location:this.key.getLocation(),
            file:this.compilation.file,
        };
    }
    parser(){
        if(super.parser()===false)return false;
        if( this.expression.params.length != 0 ){
            this.error(1065,this.key.value());
        }
        const isInterface = this.module && (this.module.isDeclaratorModule || this.module.isInterface);
        if(this.scope.returnItems.length < 1 && !isInterface){
            this.error(1066,this.key.value());
        }
    }

    getReturnedType(caller){
        const result = super.getReturnedType(caller);
        let type = null;
        if( result ){
            type = result.type();
        }
        return type || Namespace.globals.get('any')
    }

    type(){
        return this.getReturnedType()
    }
    referenceItems(){
        return super.referenceItems(true);
    }
    reference(){
        return super.reference(true);
    }
    getFunType(){
        return null;
    }
}

module.exports = MethodGetterDefinition;