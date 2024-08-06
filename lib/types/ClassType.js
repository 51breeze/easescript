const Type = require("./Type");
class ClassType extends Type{
    constructor(inherit,module,target){
        super("$ClassType",inherit)
        this.isClassType = true;
        this.module = module;
        this.target = target;
    }
    get id(){
        return this.inherit.id;
    }
    is( type, context){
        if( !type || !(type instanceof Type) )return false;
        type = this.inferType(type, context);
        type = this.getWrapAssignType(type);
        if( !this.isNeedCheckType(type) )return true;
        if( type.isUnionType ){
            return type.elements.every( item=>this.is( item.type(), context ) );
        }
       
        if( type.isClassType ){
            return this.module === type.module;
        }
        return this.module === type && this.inherit.type().is( type, context );
    }

    toString(){
        return `class<${this.target.value()}>`;
    }
}
module.exports = ClassType;