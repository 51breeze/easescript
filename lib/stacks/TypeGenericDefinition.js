const Stack = require("../core/Stack");
const Utils = require("../core/Utils");
const ClassGenericType = require("../types/ClassGenericType");
const keySymbol = Symbol("key");
class TypeGenericDefinition extends Stack {
    constructor(compilation,node,scope,parentNode,parentStack){ 
        super(compilation,node,scope,parentNode,parentStack);
        this.isTypeGenericDefinition= true;
        this.valueType = this.createTokenStack(compilation,node.value, scope, node, this);
        this.elements = node.typeElements.map( item=>{
            return this.createTokenStack(compilation,item,scope,node,this);
        });
        this.isThisType = this.valueType && this.valueType.value() === "this";
        this[keySymbol]={};
    }
    freeze(){
        super.freeze();
        super.freeze( this.elements );
        this.valueType.freeze();
        this.elements.forEach( stack=>stack.freeze() );
    }
    definition(ctx){
        const type = this.type();
        if( !type )return null;
        ctx = ctx||this.getContext();
        if( !this.isThisType ){
            let desc = this.valueType.description();
            if( desc ){
                if( desc.isModule){
                    desc = desc.moduleStack;
                    desc = desc.id || desc;
                }else if( desc.isAliasType && desc.target && desc.target.isStack){
                    desc = desc.target;
                }
            }
            if( desc && desc.isStack ){
                return {
                    comments:this.comments,
                    expre:`(type) ${type.toString(ctx)}`,
                    location:desc.getLocation(),
                    file:desc.compilation.file,
                };
            }
        }
        return type.definition(ctx)
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
    setRefBeUsed(){}
    type(){
        let type = this[keySymbol]._type;
        if( !type ){
            const value = this.valueType.value();
            const desc = this.isThisType ? this.module : (this.getModuleById( value ) || this.scope.define( value ));
            if( desc ){
                type = desc.type();
                if( type ){
                    const classType = this.getGlobalTypeById("Class");
                    const isClass = type === classType || (type.extends && type.extends[0]===classType);
                    this[keySymbol]._type = type = new ClassGenericType(
                        this.elements,
                        isClass ? classType : type,
                        isClass,
                        this
                    );
                    this.getContext().make(type);
                }
            }
        }
        return type || this.getGlobalTypeById('never');
    }

    parser(){
        if( !super.parser())return false;
        const value  = this.value();
        let baseType = this.isThisType ? this.module : (this.getModuleById( value ) || this.scope.define( value ));
        if( baseType ){
            const originType = Utils.getOriginType( baseType );
            const stack = this.compilation.getStackByModule( originType );
            let declareGenerics = stack && stack.genericity && stack.genericity.elements || [];
            if( declareGenerics.length ===0 && baseType.isAliasType && baseType.target && baseType.target.genericity ){
                declareGenerics = baseType.target.genericity.elements;
            }
            
            if(stack){
                stack.addUseRef( this.valueType );
            }

            const requires = declareGenerics.filter( item=>{
                return !item.isGenericTypeAssignmentDeclaration;
            });

            if( requires.length > this.elements.length || this.elements.length > declareGenerics.length ){
                if( requires.length === declareGenerics.length ){
                    this.valueType.error(1030,baseType.toString(),requires.length);
                }else{
                    this.valueType.error(1031,baseType.toString(),requires.length,declareGenerics.length);
                }
            }

            const sameType = baseType.type();
            this.elements.forEach( (item,index)=>{
                item.parser();
                const declareType = declareGenerics[index] && declareGenerics[index].type();
                let type = item.type();
                if(type === sameType){
                    this.item.error(1177,item.value());
                }else{
                    if( declareType && declareType.hasConstraint ){
                        if( type.isGenericType && type.assignType ){
                            type = type.assignType;
                        }
                        if( !type.isGenericType ){
                            this.checkExpressionType(declareType.inherit, type, item);
                        }
                    }
                }
            });
            
        }else{
            this.valueType.error(1083,this.value());
        }
        return true;
    }

    value(){
        return this.valueType.value()
    }
}

module.exports = TypeGenericDefinition;