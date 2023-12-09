const Stack = require("../core/Stack");
const Utils = require("../core/Utils");
const InstanceofType = require("../types/InstanceofType");
const Type = require("../types/Type");
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
        if( !this.compilation.hasManifestResource(id, this.module||this.namespace) ){
            return;
        }
        const type = this.hasLocalReferenceType(id);
        if(type){
            return ;
        }
        const hookName = this.module ? 'class.body.parser.before' : 'program.body.parser.before';
        this.compilation.hookAsync(hookName,async ()=>{
            await this.loadTypeAsync(id);
        });
    }

    freeze(){
        super.freeze();
        this.argument.freeze();
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
                const type = this.argument.type();
                type.target = this;
                return type;
            }else{
                if( this.isThisType ){
                    return this.module && this.module.isModule ? new InstanceofType(this.module, this, null, true) : this.getGlobalTypeById('never');
                }else{
                    let id = this.argument.value();
                    let type = this.getLocalReferenceType(id);
                    if(type){
                        return type.type();
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

    async parser(){
        return await this.callParser(async ()=>{
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
        })
    }
    value(){
        return this.argument.value();
    }
    raw(){
        return this.argument.raw();
    }
}

module.exports = TypeDefinition;