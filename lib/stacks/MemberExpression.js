const Stack = require("../core/Stack");
const Utils = require("../core/Utils");
const Expression = require("./Expression");
const ComputeType = require("../types/ComputeType");
const Namespace = require("../core/Namespace");
const MergeType = require("../core/MergeType");
const JSModule = require("../core/JSModule");
const keySymbol = Symbol("key");
class MemberExpression extends Expression{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isMemberExpression = true;
        this.object = this.createTokenStack( compilation, node.object, scope, node, this );
        this.property = this.createTokenStack( compilation, node.property, scope, node,this );
        this._accessor = null;
        this.computed = !!node.computed;
        this.optional = !!node.optional;
        this[keySymbol]={};
        this.addHook()
    }
    addHook(){
        if(!this.isJSXForContext() && !this.optional){

            const id = this.value();
            const maybe = this.parentStack.isCallExpression || 
                            this.parentStack.isNewExpression || 
                            this.parentStack.isAssignmentPattern && this.parentStack.node.right===this.node ||
                            this.parentStack.isAssignmentExpression && this.parentStack.node.right===this.node ||
                            this.parentStack.isVariableDeclarator && this.parentStack.node.init === this.node ||
                            this.parentStack.isMemberExpression && this.parentStack.node.object === this.node && !this.parentStack.optional ||
                            this.parentStack.isProperty && this.parentStack.node.value===this.node;

            if(maybe){
                const pp = this.getParentStack( stack=>!stack.isMemberExpression );
                if(pp && pp.isPackageDeclaration){
                    return;
                }
            }

            if( maybe && this.checkNeedToLoadTypeById(id)){
                this.compilation.hookAsync('compilation.create.after',async ()=>{
                    const desc = await this.loadTypeAsync(id);
                    if(desc && desc.isModule){
                        this.compilation.addDependency(desc, this.module)
                    }
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

        return desc.definition( context );
    }

    set accessor( val ){
        this._accessor = val;
    }

    getDescription(){
        let property = this.property.value();
        let description = this.object.descriptor();
        if(Namespace.is(description)){
            return this.getMatchDescriptor(property, description) || description.children.get(property);
        }
        else if(description){
            const object = description.isNamespaceDeclaration ? description.parentStack.module : description.module;
            if(JSModule.is(object)){
                let key = property;
                if(description.isExportAssignmentDeclaration && description.expression.isIdentifier){
                    key = description.expression.value();
                }
                let _desc = null;
                object.getDescriptor(key, (desc, prev)=>{
                    const object = desc.type();
                    const result = this.getObjectDescriptor(object, property, false, prev);
                    if(result){
                        _desc = result;
                        if(this.isLiteralObject(object)){
                            return true;
                        }
                    }
                });
                if(_desc){
                    return _desc;
                }
            }
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

                const object = this.object.type();
                if( this.property.isLiteral ){
                    const _value = this.getObjectDescriptor(object, property, Utils.isClassType(object) && object === description );
                    if(_value){
                        return _value;
                    }
                }

                if( object.isLiteralObjectType && object.attributes.size > 1){
                    const merge = new MergeType();
                    object.attributes.forEach(attr=>{
                        merge.add(attr.type())
                    });
                    return merge.type();
                }

                const origin = Utils.getOriginType(object, (type)=>{
                    return type.isLiteralObjectType || type.isLiteralArrayType;
                });

                const ctx = this.getContext();
                const pType = !this.property.isLiteral ? this.property.type() : null;
                let result = pType ? this.getObjectDynamicDescriptor(origin, pType, ctx) : null;
                if(!result){
                    result = this.getObjectDynamicDescriptor(origin, typeof property === 'number' ? 'number' : 'string', ctx);
                }
                if(result){
                    return result;
                }
                return new ComputeType(this, this.object , this.property);
            }
        }

        let objectType = this.object.type();
        if(!objectType)return null;
        if(objectType instanceof Namespace){
            return this.getMatchDescriptor(property, objectType) || objectType.children.get(property);
        }else if(objectType.isCircularType){
            objectType = Utils.getOriginType(objectType, (type)=>!type.isCircularType);
        }
        const isStatic =  Utils.isClassType(objectType) && objectType === description;
        return this.getObjectDescriptor(objectType, property, isStatic);
    }

    descriptor(){
        return this.getAttribute('MemberExpression.descriptor', ()=>{
            let _desc = this.description();
            if(_desc){
                if(this.parentStack.isCallExpression || this.parentStack.isNewExpression){
                    let object = _desc.isNamespaceDeclaration ? _desc.parentStack.module : _desc.module;
                    if(JSModule.is(object)){
                        const result = this.parentStack.getMatchDescriptor(this.property.value(), object);
                        if(result){
                            return result;
                        }
                    }else if(_desc.isDeclaratorVariable || _desc.isDeclaratorFunction){
                        object = _desc.namespace;
                        if(Namespace.is(object)){
                            const result = this.parentStack.getMatchDescriptor(this.property.value(), object);
                            if(result){
                                return result;
                            }
                        }
                    }
                }
                return _desc;
            }
            return null;
        });
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

            if(desc && desc.isProperty && desc.computed){
                const origin = this.getFirstMemberStack().description();
                const scope = this.scope;
                if(scope && origin && origin.isDeclarator && scope.allowInsertionPredicate()){
                    const predicate = scope.getPredicate(origin);
                    if(predicate){
                        return predicate.getAttribute(this.value(), desc);
                    }
                }
            }
            return desc;
        });
    }

    type(){
        return this.getAttribute('MemberExpression.type',()=>{
            const description = this.description();
            if( description ){
                if( description.isNamespace ){
                    return description;
                }
                
                let type = description.type();
                if(description.isProperty){
                    const object = this.object.type();
                    if(this.isLiteralObject(object) && Utils.isMergedType(object)){
                        const _desc = object.attribute(this.property.value());
                        if(_desc && _desc.isType){
                            type = _desc;
                        }
                    }
                }

                if( !this.parentStack.isCallExpression ){
                    const ctx = this.getContext();
                    if( type.isGenericType ){
                        type = ctx.fetch(type, true)
                    }else{
                        ctx.make(type);
                    }
                }
                if(description.isDeclaratorVariable && this.parentStack.isNewExpression){
                    return description.declarations[0].type();
                }
                return type;
            }
            return Namespace.globals.get("any");
        });
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
        if(!desc && this.object.isIdentifier){
            this.object.error(1013,this.object.value());
        }
        this.object.setRefBeUsed(desc);
        const description = this.description();
        if( description ){
            this.parserDescriptor(description);
            this.property.setRefBeUsed(description);
            if( (description.isGenericTypeDeclaration || description.isTypeStatement) && !this.scope.isDirective ){
                const parent = this.parentStack;
                if( !parent.isTypeTransformExpression && !(parent.isTypeDefinition || 
                    parent.isTypeTupleRestDefinition || 
                    parent.isTypeTupleDefinition || 
                    parent.isGenericTypeDeclaration || 
                    parent.isGenericDeclaration || 
                    parent.isTypeObjectDefinition || 
                    parent.isBinaryExpression && parent.isIsOperatorFlag ||
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
            if( !this.optional ){
                this.property.error(1060,this.raw());
            }
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

    value(){
        let optional = this.optional ? '?.' : '';
        if( this.computed ){
            return `${this.object.value()}${optional}[${this.property.raw()}]`;
        }
        return `${this.object.value()}${optional||'.'}${this.property.value()}`;
    }
}

module.exports = MemberExpression;
