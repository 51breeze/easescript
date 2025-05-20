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
        this._hasMatchAutoImporter = false;
        this.computed = !!node.computed;
        this.optional = !!node.optional;
        this[keySymbol]={};
        this.addHook()
    }

    get hasMatchAutoImporter(){
        if(this._hasMatchAutoImporter){
            return true;
        }
        if(this.object.isMemberExpression || this.object.isIdentifier){
            return this.object.hasMatchAutoImporter;
        }
        return false;
    }

    getReferenceName(){
        if(!this._hasMatchAutoImporter)return null;
        const desc = this.description();
        return this.compilation.getDescriptorReferenceName(desc);
    }

    addHook(){
        if(!this.isJSXForContext() && !this.optional){
            const id = this.value();
            let pp = this.parentStack;
            const maybe = pp.isCallExpression || 
                        pp.isNewExpression || 
                        pp.isAssignmentPattern && pp.node.right===this.node ||
                        pp.isAssignmentExpression && pp.node.right===this.node ||
                        pp.isVariableDeclarator && pp.node.init === this.node ||
                        //pp.isMemberExpression && pp.node.object === this.node && !pp.optional ||
                        pp.isProperty && pp.node.value===this.node && !(pp.parentStack.isObjectPattern || pp.parentStack.isArrayPattern);

            if(maybe){
                pp = this.getParentStack( stack=>!stack.isMemberExpression );
                if(pp){
                    if(pp.isPackageDeclaration || pp.isAnnotationExpression || pp.isAnnotationDeclaration || pp.isImportDeclaration || pp.isTypeDefinition){
                        return;
                    }
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

    resolveDefinitionContext(context){
        const pStack = this.getParentStack( (stack)=>!stack.parentStack.isMemberExpression );
        if(pStack && pStack.parentStack.isPackageDeclaration){
            return [pStack, context];
        }

        if(pStack && pStack.parentStack.isAnnotationExpression){
            return [pStack, context];
        }

        if(this.isTypeDefinitionStack(pStack.parentStack)){
            return [pStack.parentStack, context||pStack.parentStack.getContext()];
        }

        if( this.parentStack.isCallExpression || this.parentStack.isNewExpression){
            if( this.parentStack.callee === this ){
                return [this.parentStack, context||this.parentStack.getContext()];
            }
        }
        context = context || this.getContext();
        const desc = this.computed ? this.property.description() : this.description();
        if( !desc )return null;
        
        let object = Utils.inferNotNullType(this.object.type());
        if( desc.isAnyType ){
            if( object.isLiteralObjectType && object.target && object.target.isObjectExpression ){
                const type = this.parentStack.isAssignmentExpression ? this.parentStack.right.type().toString( this.parentStack.right.getContext() ) : 'any'
                return [null,context,{
                    expre:`(property) ${this.property.value()}: ${type}`,
                }];
            }
        }

        if( desc.isType && !desc.isModule && this.is(desc.target) && desc.target.compilation){
            const target = desc.target;
            return [null,context,{
                expre:`(property) ${this.property.value()}: ${this.type().toString(context)}`,
                location:target.getLocation(),
                file:target.compilation.file,
                comments:target.comments,
            }]
        }
        if(this.isLiteralObject(object) && Utils.isMergedType(object)){
            return [desc, context, null, `(property) ${this.property.value()}: ${this.type().toString(context)}`]
        }
        return [desc, context];
    }

    definition(context){
        const result = this.resolveDefinitionContext(context);
        if(!result)return null;
        let [desc, ctx, def, text] = result;
        if(def)return def;
        if(!ctx){
            ctx = this.getContext();
        }
        ctx.setHoverStack(context && context.hoverStack || this);
        let _def = desc.definition( ctx );
        if(text){
            _def.text = text;
        }
        return _def;
    }

    hover(context){
        const result = this.resolveDefinitionContext(context);
        if(!result)return null;
        let [desc, ctx, def, text] = result;
        if(def){
            return def;
        }
        if(!ctx){
            ctx = this.getContext();
        }
        ctx.setHoverStack(context && context.hoverStack || this);
        let _def = desc.hover(ctx);
        if(text){
            _def.text = text;
        }
        return _def;
    }

    set accessor( val ){
        this._accessor = val;
    }

    getDescription(){
        let property = this.property.value();
        let description = this.object.descriptor();
        let desc = null;
        if(Namespace.is(description)){
            let ns = description;
            if(this.parentStack.isMemberExpression){
                desc = description.children.get(property);
                if(desc){
                    ns = desc;
                }else{
                    desc = this.getMemberMatchDescriptor(ns, property, this.parentStack.property.value());
                }
            }else {
                if((this.parentStack.isNewExpression || this.parentStack.isCallExpression) && this.parentStack.callee === this){
                    const descriptors = description.descriptors.get(property)
                    if(descriptors && descriptors.length>0){
                        const result = descriptors.find(d=>d.isDeclaratorVariable);
                        if(result){
                            desc = result;
                        }
                    }
                }
                if(!desc){
                    desc = description.modules.get(property) || description.getDescriptor(property);
                }
            }
            if(desc && !this.compiler.options.service && this.compilation.isLocalDocument()){
                this.addAutoImporter(property, ns, desc);
            }
        }
        else if(description){
            let object = description.isModuleDeclaration ? description.module : null;
            if(!object){
                if(description.isExportAssignmentDeclaration){
                    object = description.getExportNamespace();
                }else if(JSModule.is(description)){
                    object = description;
                }
            }
            if(object){
                desc = object.getDescriptor(property, null, {isMember:true});
            }
        }

        if(desc){
            this._isGlobalRefs = true;
            return desc;
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
                    result = this.getObjectDynamicDescriptor(origin, Namespace.globals.get(typeof property === 'number' ? 'number' : 'string'), ctx);
                }
                if(result){
                    return result;
                }
                if(pType && pType.isUniqueType){
                    return null;
                }
                return new ComputeType(this, this.object , this.property);
            }
        }

        let objectType = this.object.type();
        if(!objectType)return null;
        if(objectType.isCircularType){
            objectType = Utils.getOriginType(objectType, (type)=>!type.isCircularType);
        }
        const isStatic =  Utils.isClassType(objectType) && objectType === description;
        if(objectType){
            desc = this.getObjectDescriptor(objectType, property, isStatic);
            if(desc){
                return desc;
            }
        }
        return null;
    }

    descriptor(){
        return this.getAttribute('descriptor',()=>{
            let _desc = this.description();
            if(!_desc)return null;
            if(!this._isGlobalRefs)return _desc;
            if(this.parentStack.isCallExpression){
                if(_desc.isDeclaratorVariable){
                    const type = _desc.type();
                    if(type.isFunctionType && type.target && type.target.isDeclaratorFunction){
                        _desc = type.target;
                    }
                }
                let key = this.property.value();
                let object = _desc.isNamespaceDeclaration ? _desc.parentStack.module : null;
                if(JSModule.is(_desc)){
                    object = _desc;
                }else if(JSModule.is(_desc.module)){
                    object = _desc.module;
                }else if((_desc.isDeclaratorVariable || _desc.isDeclaratorFunction) && Namespace.is(_desc.namespace)){
                    key = _desc.value();
                    object = _desc.namespace;
                }
                if(object){
                    const result = this.parentStack.getMatchDescriptor(key, object);
                    if(result){
                        return result;
                    }
                }
            }
            if(_desc.isTypeObjectPropertyDefinition){
                return this.type()
            }
            return _desc
        })
    }

    addAutoImporter(property, ns, desc){
        if(!ns.imports.has(property) || this.hasMatchAutoImporter)return;
        const prefix = ns.imports.get(ns.id);
        const has = this.compilation.hasDescriptorReferenceName(desc);
        if(prefix && prefix.namespace){
            if(!has){
                this.addImportSpecifierDependency(prefix, desc, this.scope.generateVarName(ns.id))
            }
            if(this.parentStack.isMemberExpression){
                this._hasMatchAutoImporter = true;
            }else{
                this.object._hasMatchAutoImporter = true;
            }
            return;
        }
        if(!has){
            this.addImportSpecifierDependency(ns.imports.get(property), desc, this.scope.generateVarName(property))
        }
        this._hasMatchAutoImporter = true;
    }

    description(){
        return this.getAttribute('MemberExpression.description', ()=>{
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
                if(type){
                    if(description.isProperty){
                        let object = Utils.inferNotNullType(this.object.type());
                        if(Utils.isMergedType(object)){
                            if(this.isLiteralObject(object)){
                                const _desc = object.attribute(this.property.value());
                                if(_desc && Utils.isType(_desc)){
                                    type = _desc;
                                }
                            }
                        }
                    }

                    if(description.isDeclaratorVariable && this.parentStack.isNewExpression){
                        type = description.declarations[0].type();
                    }

                    if(this.scope.allowInsertionPredicate()){
                        const predicate = this.scope.getPredicate(description);
                        if(predicate && predicate.type){
                            type = predicate.type;
                        }else{
                            const state = this.scope.getValidateState(description);
                            if(state){
                                if(state.value && !state.isAlternate || !state.value && state.isAlternate){
                                    type = Utils.inferNotNullType(type);
                                }
                            }
                        }
                    }

                    if(type.isGenericType){
                        type = this.getContext().fetch(type) || type;
                    }
                    return type;
                }
            }
            return Namespace.globals.get("any");
        });
    }

    isProtectedAccessible(target){
        let parent = this.module;
        while(parent){
            if(Utils.isEqualModule(parent, target))return true;
            parent = parent.type().getInheritModule();
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
                if(this.computed){
                    this.error(1060,this.raw());
                }else{
                    this.property.error(1060,this.raw());
                }
            }
        }else if( description.isMethodDefinition || description.isPropertyDefinition ){

            let object = Utils.getOriginType(this.object.type());
            if(object && object.isModule){
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
            }else if( modifier === "private" && !Utils.isEqualModule(description.module, this.module) ){
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
