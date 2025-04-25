const Stack = require("../core/Stack");
const Utils = require("../core/Utils");
const InstanceofType = require("../types/InstanceofType");
const Type = require("../types/Type");
const Namespace = require("../core/Namespace");
const CircularType = require("../types/CircularType");
class TypeDefinition extends Stack {
    constructor(compilation,node,scope,parentNode,parentStack){ 
        super(compilation,node,scope,parentNode,parentStack);
        this.isTypeDefinition= true;
        this.argument = this.createTokenStack(compilation,node.value, scope, node, this);
        this.isThisType = this.argument.value() === "this";
        this.addHook()
    }

    addHook(){
        if(this.argument.isLiteral || this.isThisType){
            return;
        }
        const id = this.argument.value();
        if(!Utils.isGlobalTypeName(id) && this.checkNeedToLoadTypeById(id)){
            this.compilation.hookAsync('compilation.create.after',async ()=>{
                const desc = await this.loadTypeAsync(id);
                if(desc && desc.isModule){
                    this.compilation.addDependency(desc, this.module)
                }
            });
        }
    }

    freeze(){
        super.freeze();
        this.argument.freeze();
    }
    definition(ctx){
        const type = this.type();
        if(!this.isThisType && Utils.isModule(type)){
            return type.definition(ctx);
        }
        if(Utils.isGlobalShortenType(type)){
            return {
                expre:`(type) ${type.toString()}`,
            }
        }
        ctx = ctx || this.getContext();
        if(this.is(type.target) && type.target !== this){
            return type.target.definition(ctx);
        }
        return {
            comments:this.comments,
            expre:`(type) ${type.toString(ctx)}`,
        }
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
        return this.getAttribute('type', ()=>{
            if( this.argument.isLiteral ){
                return this.argument.type();
            }else{
                if( this.isThisType ){
                    return this.module && this.module.isModule ? new InstanceofType(this.module, this, null, true) : Namespace.globals.get('never');
                }else{
                    let type = this.argument.getReferenceType();
                    if(type){
                        if(type.isTypeStatement){
                            this.argument.setRefBeUsed(type);
                        }
                        if(this.checkNestedRefs()){
                            let id = this.argument.value();
                            return new CircularType(type.type(), this, id);
                        }else{
                            return type.type();
                        }
                    }else{
                        let descriptors = null;
                        let id = this.argument.value();
                        if(id){
                            if(id.includes('.')){
                                descriptors = Namespace.fetch(id, null, true, true);
                            }else{
                                descriptors = Namespace.fetch(id, this.namespace, true, true);
                            }
                            if(descriptors){
                                const desc = descriptors.find(item=>item.isDeclaratorFunction);
                                if(desc){
                                    this.argument.setRefBeUsed(desc);
                                    return desc.type();
                                } 
                            }
                        }
                    }
                }
            }
            return Namespace.globals.get('never');
        });
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
                        this.argument.error(1141, this.value() );
                    }
                    return true;
                }else{
                    return false;
                }
            });
        }
        return this.checkedCircular;
    }

    getTypeDefinitionBeginStack(stack){
        if(!stack.parentStack)return stack;
        if(this.isTypeDefinitionStack(stack)){
            return this.getTypeDefinitionBeginStack(stack.parentStack)
        }
        return stack;
    }

    checkNestedRefs(){
        if(this.isThisType || this.argument.isLiteral)return false;
        const begin = this.getTypeDefinitionBeginStack(this.parentStack);
        if(begin !== this.parentStack){
            let id = this.argument.value();
            if(begin.isTypeStatement){
                return begin === this.scope.define(id);
            }else if(begin.isDeclaratorTypeAlias){
                return begin === Namespace.globals.raw(id);
            }
            // else if(begin.isDeclaratorDeclaration){
            //     return begin.module.type() === this.getModuleById(id)
            // }
        }
        return false;
    }

    parser(){
        if(super.parser()===false)return false;
        let type = this.type();

        //if(this.checkCircular(type))return true;

        if( type && (type.isNeverType && this.value() !=='never') || (type && !type.isType) ){
            type = null;
        }

        if( !type ){
            type = this.getModuleById(this.argument.value());
            if( type ){
                type = type.type();
                this.setAttribute('type', type)
            }
        }

        if(type){
            if(type.isModule || type.isDeclaratorTypeAlias){
                this.parserDescriptor(type)
            }
            if(!this.isThisType){
                let desc = type;
                if(type.isAliasType && type.target && type.target.isDeclaratorTypeAlias){
                    desc = type.target;
                }else{
                    let refs = this.scope.define(this.argument.value());
                    if(refs && refs.isImportDeclaration && refs.type() === type){
                        desc = refs;
                    } 
                }
                this.argument.setRefBeUsed(desc);
            }
        }

        if( !type ){
            this.argument.error(1083, this.argument.value());
        }else if(!(this.parentStack.isDeclaratorTypeAlias)){
            if( !type || !(type instanceof Type) ){
                this.argument.error(1083,this.value());
            }else if(!this.isThisType){
                let declareGgenerics = null;
                if( type.isAliasType && type.target && type.target.genericity && type.target.genericity.isGenericDeclaration){
                    declareGgenerics = type.target.genericity.elements;
                }else if( Utils.isTypeModule(type) ){
                    const result = type.getModuleDeclareGenerics(false, false, true);
                    if(result && result[1]){
                        declareGgenerics = result[1];
                    }
                }
                if(declareGgenerics){
                    const requires = declareGgenerics.filter( item=>!item.isGenericTypeAssignmentDeclaration )
                    const len = requires.length;
                    if( len > 0 ){
                        this.argument.error(1030,type.toString(),len);
                    }
                }
            }
        }
        
    }
    value(){
        return this.argument.value();
    }
    raw(){
        return this.argument.raw();
    }
}

module.exports = TypeDefinition;