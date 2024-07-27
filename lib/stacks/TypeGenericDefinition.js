const Namespace = require("../core/Namespace");
const Stack = require("../core/Stack");
const Utils = require("../core/Utils");
const ClassGenericType = require("../types/ClassGenericType");
const TupleType = require("../types/TupleType");
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
                const desc = await this.loadTypeAsync(id);
                if(desc && desc.isModule){
                    this.compilation.addDependency(desc, this.module)
                }
            });
        }else{
            const desc = this.scope.define(id);
            if(desc && desc.isModule){
                this.compilation.addDependency(desc, this.module)
            }
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
        if(!type)return null;
        ctx = ctx||this.getContext();
        if( !this.isThisType ){
            const desc = this.argument.getReferenceType();
            if(!desc)return null;
            let rawType = desc.type();
            if(rawType && rawType.isAliasType){
                const result = rawType.definition(ctx);
                if(!result)return null;
                return {
                    comments:result.comments,
                    expre:`(type) ${type.toString(ctx)}`,
                    location:result.location,
                    file:result.file,
                };
            }
            const origin = Utils.getOriginType(rawType);
            if(origin){
                return origin.definition(ctx);
            }
            return null;
        }
        return {
            expre:`type ${type.toString(ctx)}`
        };
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
            const classType = Namespace.globals.get("Class");
            const isClass = type === classType || (type.extends && type.extends[0]===classType);
            let final = null;
            if(!isClass && !this.isThisType && this.parentStack.isRestElement){
                let oArray = Namespace.globals.get('Array');
                if(type === oArray){
                    final = new TupleType(
                        oArray,
                        this.elements,
                        this
                    );
                }
            }
            if(!final){
                final = new ClassGenericType(
                    this.elements,
                    isClass ? classType : type,
                    isClass,
                    this
                );
            }
            this.setAttribute('type', type =final);
            this.getContext().make(final);
        }
        return type;
    }

    type(){
        return this.getAttribute('type', ()=>{
            let type = this.isThisType ? this.module : this.argument.getReferenceType();
            return this.makeType(type) || Namespace.globals.get('never');
        });
    }

    getDeclareGenerics(type=null){
        if(!type){
            type = this.isThisType ? this.module : this.argument.getReferenceType();
        }
        if(type){
            type = type.type();
            const originType = Utils.getOriginType( type );
            if(originType){
                if(originType.isModule && (originType.isClass || originType.isInterface)){
                    const value = originType.getModuleDeclareGenerics(false, false, true);
                    if(value.length>0)return value;
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
        let type = this.isThisType ? this.module : this.argument.getReferenceType();
        if(this.type()===Namespace.globals.get('never')){
            this.makeType(this.getModuleById(this.argument.value()))
        }
        if( type && !type.isAnyType){

            //const originType = Utils.getOriginType( type );
            // const stack = this.compilation.getStackByModule( originType );
            // let declareGenerics = stack && stack.genericity && stack.genericity.elements || [];
            // if( declareGenerics.length ===0 && type.isAliasType && type.target && type.target.genericity ){
            //     declareGenerics = type.target.genericity.elements;
            // }
            const [stack, declareGenerics=[]] = this.getDeclareGenerics(type)
            
            if(stack){
                this.parserDescriptor(type.isAliasType?type.target:stack);
                let refs = this.scope.define(value);
                if(refs && refs.isImportDeclaration && refs.type() === type){
                    refs.addUseRef(this.argument)
                }else{
                    stack.addUseRef(this.argument);
                }
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
                    item.error(1177,item.value());
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