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
        if(this.checkNeedToLoadTypeById(id)){
            this.compilation.hookAsync('compilation.create.after',async ()=>{
                await this.loadTypeAsync(id);
            }); 
        }
    }

    freeze(){
        super.freeze();
        this.argument.freeze();
    }
    definition(ctx){
        //const pStack = this.parentStack;
        //ctx = ctx || this.getContext();
        // if( pStack.isTypeTupleDefinition || pStack.isTypeTupleRestDefinition || pStack.isTypeTupleUnionDefinition || pStack.isTypeGenericDefinition){
        //     return pStack.definition(ctx);
        // }
        const type = this.type();
        if( !type ){
            return null;
        }
        return type.definition(ctx);
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
                    return this.module && this.module.isModule ? new InstanceofType(this.module, this, null, true) : this.getGlobalTypeById('never');
                }else{
                    let id = this.argument.value();
                    let type = this.getLocalReferenceType(id);
                    if(type){
                        if(this.checkNestedRefs()){
                            return new CircularType(type.type(), this, id);
                        }else{
                            return type.type();
                        }
                    }
                }
            }
            return this.getGlobalTypeById('never');
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
            this.argument.setRefBeUsed(type);
        }

        if( !type ){
            this.argument.error(1083, this.argument.value());
        }else if(!(this.parentStack.isDeclaratorTypeAlias)){
            if( !type || !(type instanceof Type) ){
                this.argument.error(1083,this.value());
            }else if(!this.isThisType){
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