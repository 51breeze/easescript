const Stack = require("../core/Stack");
const Utils = require("../core/Utils");
const ClassGenericType = require("../types/ClassGenericType");
class TypeGenericDefinition extends Stack {
    constructor(compilation,node,scope,parentNode,parentStack){ 
        super(compilation,node,scope,parentNode,parentStack);
        this.isTypeGenericDefinition= true;
        this.argument = this.createTokenStack(compilation,node.value, scope, node, this);
        this.elements = node.typeElements.map( item=>{
            return this.createTokenStack(compilation,item,scope,node,this);
        });
        this.isThisType = this.argument && this.argument.value() === "this";
    }
    freeze(){
        super.freeze();
        super.freeze( this.elements );
        this.argument.freeze();
        this.elements.forEach( stack=>stack.freeze() );
    }
    definition(ctx){
        const type = this.type();
        if( !type )return null;
        ctx = ctx||this.getContext();
        if( !this.isThisType ){
            let desc = this.argument.description();
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
        this.argument.error(code,...args);
    }
    warn(code,...args){
        this.argument.warn(code,...args);
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
        let value = this.getAttribute('type');
        if(value){
            return value;
        }

        value = this.isThisType ? this.module : this.getModuleById(this.value()) || this.scope.define(this.value());
        if(value){
            value = this.createType(value)
            this.setAttribute('type', value)
            this.getContext().make(value);
        }else{
            value = this.getGlobalTypeById('never');
            this.setAttribute('type', value)
        }
        return value;
    }

    createType(type){
        type = type.type();
        const classType = this.getGlobalTypeById("Class");
        const isClass = type === classType || (type.extends && type.extends[0]===classType);
        type = new ClassGenericType(
            this.elements,
            isClass ? classType : type,
            isClass,
            this
        );
        return type;
    }

    async parser(){
        return await this.callParser(async ()=>{

            const value = this.argument.value();
            const baseType = this.isThisType ? this.module : await this.loadTypeAsync(value) || this.scope.define(value);
            if( baseType ){
                const originType = Utils.getOriginType( baseType );
                const stack = this.compilation.getStackByModule( originType );
                let declareGenerics = stack && stack.genericity && stack.genericity.elements || [];
                if( declareGenerics.length ===0 && baseType.isAliasType && baseType.target && baseType.target.genericity ){
                    declareGenerics = baseType.target.genericity.elements;
                }
                
                if(stack){
                    stack.addUseRef( this.argument );
                }

                const requires = declareGenerics.filter( item=>{
                    return !item.isGenericTypeAssignmentDeclaration;
                });

                if( requires.length > this.elements.length || this.elements.length > declareGenerics.length ){
                    if( requires.length === declareGenerics.length ){
                        this.argument.error(1030,baseType.toString(),requires.length);
                    }else{
                        this.argument.error(1031,baseType.toString(),requires.length,declareGenerics.length);
                    }
                }

                const sameType = baseType.type();
                await this.allSettled(this.elements, async (item,index)=>{
                    await item.parser();
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

                const type = this.createType(baseType)
                this.setAttribute('type', type);
                this.getContext().make(type);
                
            }else{
                this.argument.error(1083,this.value());
            }
        })
    }

    value(){
        return this.argument.value()
    }
}

module.exports = TypeGenericDefinition;