const Namespace = require("../core/Namespace");
const Type = require("./Type");
class VoidType extends Type{
    constructor(){
        super("$void");
        this.isVoidType = true;
    }
    is(type){
        if( !type || type === this)return true;
        type = this.getWrapAssignType(type);
        if( type.isInstanceofType && type.generics && type.generics.length === 1 ){
            const PromiseModule = Namespace.globals.get('Promise');
            const inheritModule = type.inherit;
            if( PromiseModule && inheritModule && PromiseModule.is( inheritModule.type() ) ){
                type = type.generics[0].type();
            }
        }
        return !!type.isVoidType;
    }
    toString(){
        return 'void';
    }
}
module.exports = VoidType;