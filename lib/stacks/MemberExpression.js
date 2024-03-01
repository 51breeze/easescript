const Stack = require("../core/Stack");
const Utils = require("../core/Utils");
const Expression = require("./Expression");
const ComputeType = require("../types/ComputeType");
const Namespace = require("../core/Namespace");
const keySymbol = Symbol("key");
class MemberExpression extends Expression{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isMemberExpression = true;
        this.object = this.createTokenStack( compilation, node.object, scope, node, this );
        this.property = this.createTokenStack( compilation, node.property, scope, node,this );
        this._accessor = null;
        this.computed = !!node.computed;
        this[keySymbol]={};
        this.addHook()
    }
    addHook(){
        if(!this.isJSXForContext()){
            const id = this.value();
            const maybe = (this.parentStack.isCallExpression || this.parentStack.isNewExpression || this.parentStack.isAssignmentPattern && this.parentStack.node.right===this.node);
            if( maybe && this.checkNeedToLoadTypeById(id)){
                this.compilation.hookAsync('compilation.create.after',async ()=>{
                    await this.loadTypeAsync(id);
                });
            }
        }
    }
    freeze(){
        super.freeze();
        this.object.freeze();
        this.property.freeze();
    }
    reference(called){
        const description = this.getDescription();
        if( description !== this && description instanceof Stack ){
            return description.reference(called);
        }
        return this;
    }
    referenceItems(called){
        const description = this.getDescription();
        if( description !== this && description instanceof Stack ){
            return description.referenceItems(called);
        }
        return [this];
    }
    definition( context ){

        const pStack = this.getParentStack( (stack)=>!stack.isMemberExpression );
        if(pStack && pStack.isPackageDeclaration){
            return pStack.definition( context );
        }

        if(pStack && pStack.isAnnotationExpression){
            return pStack.definition( context );
        }

        if(this.isTypeDefinitionStack(pStack)){
            return pStack.definition(context);
        }

        if( this.parentStack.isCallExpression || this.parentStack.isNewExpression){
            if( this.parentStack.callee === this ){
                return this.parentStack.definition( context );
            }
        }
        context = context || this.getContext();
        const desc = this.computed ? this.property.description() : this.description();
        if( !desc )return null;
        
        if( desc.isAnyType ){
            const object = this.object.type();
            if( object.isLiteralObjectType && object.target && object.target.isObjectExpression ){
                const type = this.parentStack.isAssignmentExpression ? this.parentStack.right.type().toString( this.parentStack.right.getContext() ) : 'any'
                return {
                    expre:`(property) ${this.property.value()}: ${type}`,
                }
            }
        }

        if( desc.isType && !desc.isModule && desc.target && desc.target.isStack && desc.target.compilation){
            const target = desc.target;
            return {
                expre:`(property) ${this.property.value()}: ${desc.type().toString(context)}`,
                location:target.getLocation(),
                file:target.compilation.file,
                comments:target.comments,
            }
        }

        if( desc.isNamespace ){
            if( desc.stack && desc.stack.isStack ){
                const def = desc.stack.definition( context );
                if( def ){
                    def.range = this.node.loc;
                    return def;
                }
            }
            return null;
        }

        const def = desc.definition( context );
        return def;
    }

    set accessor( val ){
        this._accessor = val;
    }

    getDescription(){
        let property = this.property.value();
        let description = this.object.description();
        if(description && description instanceof Namespace ){
            return this.getMatchDescriptor(property, description) || description.children.get(property);
        }
        if( this.computed ){
            if( this.property.isIdentifier ){
                const refs = this.property.reference();
                const desc = this.property.description();
                if( refs === this.property && desc && !(desc.isDeclarator && desc instanceof Stack) ){
                    this.computed = false;
                }
            }
            if( this.computed ){
                return new ComputeType(this, this.object , this.property);
            }
        }

        let objectType = this.object.type();
        if(objectType instanceof Namespace){
            return this.getMatchDescriptor(property, objectType) || objectType.children.get(property);
        }
        
        const isStatic =  Utils.isClassType(objectType) && objectType === this.object.description();
        return this.getObjectDescriptor(objectType, property, isStatic);
    }

    description(){
        return this.getAttribute('MemberExpression.description', ()=>{
            if( this.parentStack.isImportDeclaration ){
                return this.getModuleById(this.value());
            }else if( this.parentStack ){
                const pStack = this.getParentStack( (stack)=>!stack.isMemberExpression );
                if(pStack && pStack.isImportDeclaration){
                    return Namespace.fetch(this.value(), null, true)
                }
            }
            let desc = this.getDescription();
            if( !desc ){
                const module =  this.module;
                desc = this.getModuleById( this.value() ) || null;
                if( desc && Utils.isClassType(desc) && desc !== module ){
                    this.compilation.addDependency(desc, this.module);
                }
            }
            return desc;
        });
    }

    type(){
        const description = this.description();
        if( description ){
            if( description.isNamespace ){
                return description;
            }
            let type = description.type();
            if( !this.parentStack.isCallExpression ){
                const ctx = this.getContext();
                if( type.isGenericType ){
                    type = ctx.fetch(type, true)
                }else{
                    ctx.make(type);
                }
            }
            return type;
        }
        return this.getGlobalTypeById("any");
    }

    isProtectedAccessible(target){
        if( target === this.module ){
            return true;
        }
        let parent = this.module;
        while( parent = parent.extends[0] ){
            if(parent===target)return true;
        }
        return false;
    }

    getFirstMemberStack(){
        if( this.object.isMemberExpression ){
            return this.object.getFirstMemberStack();
        }else{
            return this.object;
        }
    }

    getContext(){
        const ctx = super.getContext();
        ctx.make( this.object.type() );
        return ctx;
    }
    
    parser(){
        if(super.parser()===false)return false;
            
        this.object.parser();
        let desc = this.object.description();
        this.object.setRefBeUsed(desc);
        const description = this.description();
        if( description ){
            this.parserDescriptor(description);
            if( (description.isGenericTypeDeclaration || description.isTypeStatement) && !this.scope.isDirective ){
                const parent = this.parentStack;
                if( !parent.isTypeTransformExpression && !(parent.isTypeDefinition || 
                    parent.isTypeTupleRestDefinition || 
                    parent.isTypeTupleDefinition || 
                    parent.isGenericTypeDeclaration || 
                    parent.isGenericDeclaration || 
                    parent.isTypeObjectDefinition || 
                    parent.isTypeObjectPropertyDefinition || 
                    parent.isTypeFunctionDefinition || 
                    parent.isTypeUnionDefinition) ){
                    this.error(1059,this.value());
                }
            }

            if( description.isNamespace && !this.parentStack.isMemberExpression ){
                this.error(1059,this.value());
            }
        }

        if( this.computed ){
            this.property.parser();
            this.property.setRefBeUsed();
            const propertyType = this.property.type();
            if( propertyType.isTupleType || propertyType.isLiteralObjectType || propertyType.isLiteralArrayType ){
                this.property.error(1150,propertyType.toString());
            }
        }

        if( !description ){
            this.property.error(1060,this.raw());
        }else if( description.isMethodDefinition || description.isPropertyDefinition ){

            let object = Utils.getOriginType(this.object.type());
            if(object.isModule){
                if(object.isRemoved(this.property.value(), description)){
                    this.error(1181, this.raw())
                }
                if(object.isDeprecated(this.property.value(), description)){
                    object.getDescriptor(this.property.value(), (desc)=>{
                        if(desc.isDeprecated){
                            const deprecatedAnnotation = desc.annotations.find(item=>item.name.toLowerCase()==='deprecated')
                            if(deprecatedAnnotation){
                                const args = deprecatedAnnotation.getArguments();
                                const message = args[0] ? args[0].value : '';
                                this.deprecated(1182, this.raw(), message)
                            }
                        }
                    });
                }
            }

            const modifier = description.modifier ? description.modifier.value() : 'public';
            if( modifier !=="public" && this.scope.type("top") ){
                this.property.error(1061,this.raw());
            }else if( modifier === "private" && description.module !== this.module ){
                this.property.error(1061,this.raw());
            }else if(modifier === "protected" && !this.isProtectedAccessible(description.module) ){
                this.property.error(1061,this.raw());
            }
        }
      
    }

    raw(){
        if( this.computed ){
            return `${this.object.raw()}[${this.property.raw()}]`;
        }
        return `${this.object.raw()}.${this.property.raw()}`;
    }

    value(){
        if( this.computed ){
            return `${this.object.value()}[${this.property.raw()}]`;
        }
        return `${this.object.value()}.${this.property.value()}`;
    }
}

module.exports = MemberExpression;
