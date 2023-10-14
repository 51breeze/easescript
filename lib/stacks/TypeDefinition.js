const Stack = require("../core/Stack");
const Utils = require("../core/Utils");
const InstanceofType = require("../types/InstanceofType");
const Type = require("../types/Type");
const keySymbol = Symbol("key");
class TypeDefinition extends Stack {
    constructor(compilation,node,scope,parentNode,parentStack){ 
        super(compilation,node,scope,parentNode,parentStack);
        this.isTypeDefinition= true;
        this.valueType = this.createTokenStack(compilation,node.value, scope, node, this);
        this.isThisType = this.valueType.value() === "this";
        this[keySymbol] = this;
    }
    freeze(){
        super.freeze();
        this.valueType.freeze();
    }
    definition(ctx){
        const pStack = this.parentStack;
        ctx = ctx || this.getContext();
        if( pStack.isTypeTupleDefinition || pStack.isTypeTupleRestDefinition || pStack.isTypeTupleUnionDefinition || pStack.isTypeGenericDefinition){
            return pStack.definition(ctx);
        }
        const type = this.type();
        if( !type ){
            return null;
        }
        return type.definition(ctx);
    }

    error(code,...args){
        this.valueType.error(code,...args);
    }
    warn(code,...args){
        this.valueType.warn(code,...args);
    }
    description(){
        return this;
    }
    reference(){
        return this;
    }
    referenceItems(){
        return [this];
    }
    setRefBeUsed(){
        
    }
    type(){
        let type = this[keySymbol]._type;
        if( !type ){
            let value = this.valueType.value();
            if( this.valueType.isLiteral ){
                type = this.valueType.type();
                type.target = this;
                this[keySymbol]._type = type;
            }else{
                if( this.isThisType ){
                    type = this.module && this.module.isModule ? new InstanceofType(this.module, this, null, true) : this.getGlobalTypeById('never');
                }else{
                    type = this.scope.define( value );
                    if( this.checkCircular(type) ){
                        return this.getGlobalTypeById('never');
                    }
                    if( type && !(type instanceof Type) ){
                        type = type.isGenericTypeDeclaration || 
                        type.isGenericTypeAssignmentDeclaration || 
                        type.isTypeStatement || 
                        (type.isEnumDeclaration && type.isExpressionDeclare)
                        ? type.type() : null;
                    }
                }
                if( !type ){
                    type = this.getModuleById( value );
                }
                this[keySymbol]._type = type
            }
        }
        return type ? type.type() : this.getGlobalTypeById('never');
    }

    checkCircular(type){
        if( this.checkedCircular !== void 0 ){
            return this.checkedCircular;
        }
        this.checkedCircular = false;
        if( type ){
            this.getParentStack( stack=>{
                if( stack.isTypeGenericDefinition || stack.isGenericTypeDeclaration || stack.isTypeDefinition || stack.isTypeStatement ){
                    if( stack === type){
                        this.checkedCircular = true;
                        this.valueType.error(1141, this.value() );
                    }
                    return true;
                }else{
                    return false;
                }
            });
        }
        return this.checkedCircular;
    }

    parser(){
        if( !super.parser())return false;
        let type = this.type();
        this.valueType.setRefBeUsed(type);
        if( this.checkCircular(type) )return true;
        if( type && (type.isNeverType && this.value() !=='never') || (type && !type.isType) ){
            type = null;
        }
        if( !type ){
            this.valueType.error(1083, this.valueType.value() );
        }else if( !(this.parentStack.isDeclaratorTypeAlias) ){
            if( !type || !(type instanceof Type) ){
                this.valueType.error(1083,this.value());
            }else{
                let declareGgenerics = null;
                if( type.isAliasType && type.target && type.target.genericity && type.target.genericity.isGenericDeclaration){
                    declareGgenerics = type.target.genericity;
                }else if( Utils.isTypeModule(type) ){
                    const stackModule = type.moduleStack;
                    if( stackModule && stackModule.genericity && stackModule.genericity.isGenericDeclaration ){
                        declareGgenerics = stackModule.genericity
                    }
                }
                if(declareGgenerics ){
                    const requires = declareGgenerics.elements.filter( item=>!item.isGenericTypeAssignmentDeclaration )
                    const len = requires.length;
                    if( len > 0 ){
                        this.valueType.error(1030,type.toString(),len);
                    }
                }
            }
        }
        return true;
    }
    value(){
        return this.valueType.value();
    }
    raw(){
        return this.valueType.raw();
    }
}

module.exports = TypeDefinition;