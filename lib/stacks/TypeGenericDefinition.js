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
        this.addHook();
    }

    addHook(){
        if(this.isThisType){
            return;
        }
        const id = this.argument.value();
        if(this.checkNeedToLoadTypeById(id)){
            this.compilation.hookAsync('compilation.create.after',async ()=>{
                await this.loadTypeAsync(id);
            });
        }
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

    makeType(type){
        if( type ){
            type = type.type();
            const classType = this.getGlobalTypeById("Class");
            const isClass = type === classType || (type.extends && type.extends[0]===classType);
            type = new ClassGenericType(
                this.elements,
                isClass ? classType : type,
                isClass,
                this
            );
            this.setAttribute('type', type);
            this.getContext().make(type);
        }
        return type;
    }

    type(){
        return this.getAttribute('type', ()=>{
            let type = this.isThisType ? this.module : this.getLocalReferenceType(this.argument.value())
            return this.makeType(type) || this.getGlobalTypeById('never');
        });
    }

    getDeclareGenerics(type=null){
        if(!type){
            type = this.isThisType ? this.module : this.getLocalReferenceType(this.argument.value());
        }
        if(type){
            type = type.type();
            const originType = Utils.getOriginType( type );
            if(originType){
                if(originType.isModule && (originType.isClass || originType.isInterface)){
                    const statcks = originType.getStacks().filter( stack=>!!stack.genericity).sort((a,b)=>{
                        return a.genericity.elements.length - b.genericity.elements.length;
                    });
                    if(statcks.length>0){
                        return [statcks[0],statcks[0].genericity.elements];
                    }
                }
                if(type.isAliasType && type.target && type.target.genericity){
                    return [type.target, type.target.genericity.elements];
                }
            }
        }
        return [];
    }

    parser(){
        if(super.parser()===false)return false;
        const value = this.argument.value();
        let type = this.isThisType ? this.module : this.getLocalReferenceType(value);
        if(this.type()===this.getGlobalTypeById('never')){
            this.makeType(this.getModuleById(this.argument.value()))
        }
        if( type ){

            //const originType = Utils.getOriginType( type );
            // const stack = this.compilation.getStackByModule( originType );
            // let declareGenerics = stack && stack.genericity && stack.genericity.elements || [];
            // if( declareGenerics.length ===0 && type.isAliasType && type.target && type.target.genericity ){
            //     declareGenerics = type.target.genericity.elements;
            // }
            const [stack, declareGenerics=[]] = this.getDeclareGenerics(type)
            
            if(stack){
                this.parserDescriptor(type.isAliasType?type.target:stack);
                stack.addUseRef(this.argument);
            }

            const requires = declareGenerics.filter( item=>{
                return !item.isGenericTypeAssignmentDeclaration;
            });

            if( requires.length > this.elements.length || this.elements.length > declareGenerics.length ){
                if( requires.length === declareGenerics.length ){
                    this.argument.error(1030,type.toString(),requires.length);
                }else{
                    this.argument.error(1031,type.toString(),requires.length,declareGenerics.length);
                }
            }

            const sameType = type.type();
            this.elements.forEach((item,index)=>{
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
            this.argument.error(1083,this.value());
        }
    }

    value(){
        return this.argument.value()
    }
}

module.exports = TypeGenericDefinition;