const Utils = require("./Utils");
const EventDispatcher = require("./EventDispatcher.js");
const MergeType = require("./MergeType");
const Constant = require("./Constant");
const Module = require("./Module");
const Type = require("../types/Type");
const Context = require("./Context");
const Namespace = require("./Namespace");
const Specifier = require("./Specifier");
const keySymbol = Symbol('key');
class Stack extends EventDispatcher{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(); 
        this.compilation  = compilation;
        this.mtime = compilation.mtime;
        this.compiler = compilation.compiler;
        this.isStack = true;
        this.node    = node;
        this.scope   = scope;
        this.parentNode  = parentNode;
        this.parentStack  = parentStack;
        this.childrenStack = [];
        this.namespace = compilation.namespace;
        this.module    = null;
        this.isFragment = false
        this.file = compilation.file;
        this.childIndexAt = 0;
        this[keySymbol] = {
            context:null,
            attributes:Object.create(null),
            specifier:null
        };
        this._useRefItems = null;
        if( parentStack ){
            this.childIndexAt = parentStack.childrenStack.length;
            parentStack.childrenStack.push(this);
            this.isFragment = parentStack.isFragment;
            this.namespace = parentStack.namespace;
            this.module = parentStack.module;
        }
        if(node){
            if( compilation.compiler.options.enableStackMap ){
                if( !(parentStack && parentStack.isFragment) ){
                    this.compilation.addStack( this );
                }
            }
            this.comments = node.comments;
        }
    }

    addUseRef( stack ){
        if( stack && stack.isStack ){
            if(stack.compilation){
                stack.compilation.addReferenceStack(this);
            }
            this.useRefItems.add(stack);
        }
    }

    get useRefItems(){
        if( !this._useRefItems ){
            return this._useRefItems = new Set();
        }
        return this._useRefItems;
    }

    isSameSource( stack ){
        return stack && stack.compilation === this.compilation && stack.mtime === this.mtime;
    }

    hasAttribute(name){
        const data = this[keySymbol].attributes;
        return Object.prototype.hasOwnProperty.call(data, name);
    }

    getAttribute(name, initCallback=null){
       const data = this[keySymbol].attributes;
       if(initCallback){
            if(!Object.prototype.hasOwnProperty.call(data, name)){
                const value = initCallback();
                if(value !== void 0){
                    data[name] = value;
                }
            }
       }
       return data[name];
    }

    setAttribute(name,value){
        const data = this[keySymbol].attributes;
        return data[name] = value;
    }

    createTokenStack(compilation,node,scope,parentNode,parentStack){
        return Stack.create(compilation,node,scope,parentNode,parentStack);
    }

    async createCompleted(){}

    getGlobalTypeById(id){
        const value = this.compilation.getGlobalTypeById( id );
        if( !value ){
            this.error(1083,id);
        }
        return value;
    }

    getTypeById(id,context){
        context = context||this.module||this.namespace
        return this.compilation.getModuleById(id, context);
    }

    getModuleById(id, context){
        context = context||this.module||this.namespace
        return this.compilation.getModuleById(id, context);
    }

    hasModuleById(id, context){
        context = context||this.module||this.namespace
        return this.compilation.hasModuleById(id, context);
    }

    checkNeedToLoadTypeById(id, context){
        let type = this.scope.define(id);
        if( type ){
            if((this.isTypeDefinition || this.isTypeGenericDefinition) && !(type instanceof Type)){
                if(type.isGenericTypeDeclaration || 
                    type.isGenericTypeAssignmentDeclaration || 
                    type.isTypeStatement || 
                    (type.isEnumDeclaration && type.isExpressionDeclare))
                {
                    return false;
                }
            }else{
                return false;
            }
        }
        context = context||this.module||this.namespace;
        return this.compilation.checkNeedToLoadTypeById(id, context);
    }

    async loadTypeAsync(id, context){
        context = context||this.module||this.namespace;
        return await this.compilation.loadTypeAsync(id, context, !!this.isImportDeclaration);
    }

    getLocation(){
       return this.node.loc || null;
    }

    getContext(){
        let ctx = this[keySymbol].context;
        if(ctx)return ctx;
        let parent = null;
        if( this.isTypeDefinitionStack(this) ){
            if(this.parentStack.isFunctionExpression && this.parentStack.parentStack.isMethodDefinition){
                parent = this.parentStack;
            }else if(this.parentStack.isDeclaratorVariable && this.parentStack.parentStack.isPropertyDefinition){
                parent = this.parentStack.parentStack;
            }else if( this.isTypeDefinitionStack(this.parentStack) ){
               ctx = this.parentStack.getContext();
            }
        }else if( this.isFunctionExpression){
            let stack = this.parentStack;
            while( stack && (stack.isProperty || stack.isObjectExpression || stack.isArrayExpression)){
                stack = stack.parentStack;
            }
            if( stack.isCallExpression || stack.isNewExpression ){
                parent = stack;
            }else{
                if( this.parentStack.isMethodDefinition ){
                    const module = this.parentStack.module;
                    if(module){
                        parent = module.moduleStack;
                    }
                }
            }
        }else if(this.isPropertyDefinition){
            const module = this.module;
            if(module){
                parent = module.moduleStack;
            }
        }else if(this.isCallExpression || this.isNewExpression){
            if(this.callee.isParenthesizedExpression){
                parent = this.callee.expression;
            }else{
                parent = this.callee;
            }
        }else if(this.isMemberExpression){
            parent = this.object;
        }else if(this.parentStack && this.parentStack.isMemberExpression && this===this.parentStack.property){
            ctx = this.parentStack.getContext();
        }

        if(!ctx){
            if( parent && parent !== this){
               ctx = parent.getContext();
            }
            if( ctx ){
                ctx = ctx.createChild(this);
            }else{
                ctx = new Context(this);
            }
        }
        this[keySymbol].context = ctx;
        return ctx;
    }

    newContext(){
        return new Context(this);
    }

    createSpecifier(stack, context){
        if( stack && !(stack instanceof Stack) ){
            throw new Error('Stack.createSpecifier stack param invalid.');
        }else{
            stack = this;
        }
        let spe = stack[keySymbol].specifier;
        if( spe ){
            return spe;
        }
        const specifier = new Specifier(stack,context);
        stack[keySymbol].specifier = specifier;
        return specifier;
    }

    getParentStack( callback , flag=false){
        let parent = flag ? this : this.parentStack;
        while( parent && !callback(parent) && parent.parentStack){
            parent = parent.parentStack;
        }
        return parent || this;
    }
    definition( context ){
        if( this.parentStack ){
            return this.parentStack.definition( context );
        }
        return null;
    }
    reference(){
        return this;
    }
    referenceItems(){
        return [];
    }
    description(){
        return this;
    }
    type(){
        return null;
    }

    getLocalReferenceType(id){
        return this.getAttribute('getLocalReferenceType:'+id,()=>{
            let type = this.scope.define(id);   
            if( type && !(type instanceof Type) ){
                if(type.isGenericTypeDeclaration || 
                    type.isGenericTypeAssignmentDeclaration || 
                    type.isTypeStatement || 
                    (type.isEnumDeclaration && type.isExpressionDeclare))
                {
                    return type
                }
                type = null;
            }
            if(!type){
                type = this.getModuleById(id);
            }
            return type || void 0;
        });
    }

    hasLocalReferenceType(id){
        return this.getAttribute('hasLocalReferenceType:'+id,()=>{
            let type = this.scope.define(id);   
            if( type && !(type instanceof Type) ){
                if(type.isGenericTypeDeclaration || 
                    type.isGenericTypeAssignmentDeclaration || 
                    type.isTypeStatement || 
                    (type.isEnumDeclaration && type.isExpressionDeclare))
                {
                    return true
                }
                type = null;
            }
            if(!type){
                type = this.hasModuleById(id);
            }
            return !!type;
        });
    }

    getTypeDisplayName(type, ctx, options={}){
        if( !type )return 'unknown';
        ctx = ctx || this.getContext();
        if( Array.isArray(type) ){
            if( type.length > 1 ){
                return type.map( item=>item.type().toString(ctx, options) ).join(' | ');
            }else{
                type = type[0].type();
            }
        }
        return MergeType.to( Utils.inferTypeValue(type, ctx.inference) ).toString(ctx, options);
    }

    getTypeLiteralValueString(type, ctx){
        if(!type)return 'unknown';
        ctx = ctx || this.getContext();
        type = ctx.fetch(type, true);
        if( type.isLiteralType ){
            return type.toString(ctx, {toLiteralValue:true});
        }
        return type.toString(ctx);
    }

    isLiteralValueConstraint(type, ctx){
        ctx = ctx || this.getContext();
        const check = (type, flag)=>{
            if( type ){
                type = ctx.fetch(type, true);
                if( type.isLiteralType && (flag || type.isLiteralValueType)){
                    return true
                }else if( type.isKeyofType ){
                    return true;
                }else if( type.isUnionType ){
                    return type.elements.every( item=>{
                        return check(item.type(), true);
                    })
                }
            }
            return false;
        }
        return check(type);
    }

    checkGenericConstraint(genericType,argumentStack,context){
        var checkResult = true;
        if( genericType.isGenericType && genericType.hasConstraint ){
            const acceptType = genericType.inherit;
            const assignType = context.fetch(genericType);
            if(assignType && !assignType.isGenericType && !acceptType.check( assignType, context) ){
                checkResult = false;
                argumentStack.error(
                    1003, 
                    this.getTypeDisplayName(assignType, context, {toLiteralValue:acceptType.isKeyofType}),
                    this.getTypeDisplayName(acceptType, context)
                );
            }
        }
        return checkResult;
    }

    isGenericsRelationValue(acceptType, declareGenerics, assigments){
        if(!acceptType)return false
        acceptType = acceptType.type();
        if( !acceptType.hasGenericType ){
            return false;
        }
        if( acceptType.isGenericType ){
            if( declareGenerics.length > 0){
                const index = declareGenerics.findIndex( item=>item.type() === acceptType );
                if( index >= 0 && !(assigments && assigments[index]) ){
                    return true
                }
            }
            return false;
        }else if( acceptType.isUnionType /*|| acceptType.isClassGenericType || acceptType.isTupleType*/ ){
            return acceptType.elements.some( item=>this.isGenericsRelationValue(item, declareGenerics, assigments) )
        }else if( acceptType.isIntersectionType ){
            return this.isGenericsRelationValue(acceptType.left, declareGenerics, assigments) 
                    || this.isGenericsRelationValue(acceptType.right, declareGenerics, assigments);
        }
        // else if( acceptType.isLiteralObjectType && acceptType.target.isTypeObjectDefinition){
        //     return Array.from( acceptType.properties.values() ).some( item=>this.isGenericsRelationValue(item, declareGenerics, assigments) )
        // }
        return false;
    }

    checkExpressionType(acceptType, expression, curStack=null, ctx=null){
        let checkResult = true;
        if( acceptType && expression ){
            acceptType = acceptType.type();
            if(!ctx){
                ctx = expression.isStack && expression.node && expression.compilation ? expression.getContext() : this.getContext();
            }
            if( expression.isArrayExpression || expression.isObjectExpression || expression.isSpreadElement && expression.argument.isArrayExpression ){
                ctx.errorHandler=(result, acceptType, assignmentStack, assignmentType)=>{
                    if( !result && assignmentStack && assignmentStack.isStack ){
                        if( assignmentStack.isProperty && assignmentStack.init ){
                            assignmentStack = assignmentStack.init;
                        }
                        assignmentType = assignmentType || assignmentStack.type();
                        //const is = assignmentStack.parentStack === expression || assignmentStack.parentStack && assignmentStack.parentStack.parentStack === expression;
                        //const targetStack = is ? assignmentStack : (curStack||expression);
                        assignmentStack.error(1009,this.getTypeDisplayName(assignmentType, ctx), this.getTypeDisplayName( acceptType , ctx ) );
                        checkResult = false;
                        return true;
                    }
                    return result;
                }
            }
            if( acceptType && !acceptType.check( expression, ctx ) ){
                let target = curStack || expression;
                if( !(target && target.isStack) )target = this;
                target.error(1009, this.getTypeDisplayName( expression.type(), ctx) , this.getTypeDisplayName( acceptType, ctx) );
                checkResult = false;
            }
            ctx.errorHandler=null;
        }
        return checkResult;
    }

    checkArgumentItemType(argumentStack, declareParam, acceptType, context, whenErrorStack){
        var checkResult = true;
        if( declareParam.isObjectPattern ){
            const argumentType = argumentStack.type();
            let isModule = (argumentType.isEnum && argumentType.isModule) || (argumentType.isInterface && argumentType.isModule);
            if( argumentType.isLiteralObjectType || argumentType.isInstanceofType || argumentType.isEnumType || isModule ){
                declareParam.properties.forEach( property=>{
                    let propertyStack = isModule ? argumentType.getMember(property.key.value(),'get') : argumentType.attribute( property.key.value(), 'get');
                    let throwErrorStack = argumentStack.isObjectExpression && propertyStack && propertyStack.isStack && propertyStack.init ? propertyStack.init : argumentStack;
                    if( propertyStack && propertyStack.isStack ){
                        checkResult = this.checkArgumentItemType(propertyStack, property, property.type(), context, throwErrorStack);
                    }else if(argumentStack.isObjectExpression){
                        checkResult = false;
                        (whenErrorStack || argumentStack).error(1152, property.key.value() );
                    }
                });
            }else if( !argumentType.isAnyType && acceptType){
                if( !acceptType.is(argumentType,context) ){
                    checkResult = false;
                    (whenErrorStack || argumentStack).error(1002, this.getTypeDisplayName( argumentType, context ), this.getTypeDisplayName(acceptType,context) );
                }
            }
        }else if( declareParam.isArrayPattern){
            const argumentType = argumentStack.type();
            if( argumentType.isLiteralArrayType ){
                declareParam.elements.forEach( (property,index)=>{
                    let propertyStack = argumentType.attribute( index );
                    let throwErrorStack = argumentStack.isArrayExpression && propertyStack && propertyStack.isStack ? propertyStack : argumentStack;
                    if( propertyStack ){
                        return this.checkArgumentItemType( propertyStack, property, property.type(), context, throwErrorStack );
                    }else if( argumentStack.isArrayExpression ){
                        checkResult = false;
                        (whenErrorStack || argumentStack).error(1152, `index-property-${index}` );
                    }
                });
            }else{
                const iteratorType = this.getGlobalTypeById('Iterator');
                if( !argumentType.is( iteratorType, context) ){
                    checkResult = false;
                    (whenErrorStack || argumentStack).error(1002, this.getTypeDisplayName( argumentType, context ), this.getTypeDisplayName(iteratorType,context), context );
                }
            }
        }else if(acceptType){

            const orgType = acceptType;
            const checkConstraint=(acceptType, argumentStack, context)=>{
                if( !this.checkGenericConstraint(acceptType, argumentStack, context) ){
                    checkResult = false;
                }
            }
            
            if( acceptType.isGenericType ){
                checkConstraint(acceptType, argumentStack, context);
            }else if(acceptType.hasGenericType ){
                if(acceptType.isTupleType || acceptType.isUnionType || acceptType.isLiteralArrayType){
                    acceptType.elements.forEach( elem=>checkConstraint(elem.type(), argumentStack, context));
                }else if( acceptType.isLiteralObjectType ) {
                    acceptType.properties.forEach( elem=>checkConstraint( elem.type(), argumentStack, context) );
                    acceptType.dynamicProperties && acceptType.dynamicProperties.forEach( elem=>checkConstraint( elem.type(), argumentStack, context) );
                }
            }

            if( acceptType ){
                if( argumentStack.isArrayExpression || argumentStack.isObjectExpression || argumentStack.isSpreadElement && argumentStack.argument.isArrayExpression ){
                    context.errorHandler=(result, acceptType, checkStack)=>{
                        if( !result && checkStack && checkStack.isStack ){
                            if( checkStack.isProperty && checkStack.init ){
                                checkStack = checkStack.init;
                            }else if( checkStack.parentStack.isProperty ){
                                checkStack = checkStack.parentStack;
                            }
                            if(acceptType){
                                checkStack.error(1002,this.getTypeDisplayName( checkStack.type(), context ), this.getTypeDisplayName( acceptType , context ) );
                            }else{
                                checkStack.error(1009,this.getTypeDisplayName( checkStack.type(), context ), 'unknown'); 
                            }
                            return true;
                        }
                        return result;
                    }
                }
                if( !acceptType.type().check(argumentStack, context) ){
                    checkResult = false;
                    if( orgType.hasConstraint ){
                        (whenErrorStack || argumentStack).error(1003, this.getTypeDisplayName( argumentStack.type(), context ), this.getTypeDisplayName( orgType.inherit, context ) );
                    }else{
                        (whenErrorStack || argumentStack).error(1002,this.getTypeDisplayName( argumentStack.type(), context ), this.getTypeDisplayName( acceptType , context ) );
                    }
                }
                context.errorHandler = null;
                return checkResult;
            }
        }
        return checkResult;
    }

    checkMatchType(argumentStack, declareParam, acceptType, context){
        const argumentType = argumentStack.type();
        if( !argumentType ){
            return false;
        }
        if( argumentType.isGenericType ){
            return true;
        }
        if( declareParam && declareParam.isObjectPattern ){
            if( argumentType.isLiteralObjectType || argumentType.isInstanceofType || argumentType.isEnumType || (argumentType.isEnum && argumentType.isModule) ){
                return true;
            }else{
                const objectType = this.getGlobalTypeById('object');
                return objectType.is(argumentType, context);
            }

        }else if(declareParam && declareParam.isArrayPattern){
            const arrayType = this.getGlobalTypeById('array');
            return arrayType.is(argumentType);
        }else if(acceptType){
            if(acceptType && acceptType.isClassGenericType ){
                const wrap = acceptType.inherit.type();
                if(argumentType.isClassGenericType){
                    return wrap.is(acceptType.inherit.type()); 
                }
                if( wrap && wrap.target && wrap.target.isDeclaratorTypeAlias && wrap.target.genericity ){
                    acceptType = wrap.inherit.type();
                }
            }
            if( acceptType.isGenericType && context && context.isContext && context instanceof Context){
                acceptType = context.fetch(acceptType, true);
            }
            if( acceptType.isGenericType ){
                return true;
            }else if( acceptType.isFunctionType ){
                return argumentType.isFunctionType;
            }else if( acceptType.isLiteralObjectType ){
                return acceptType.constraint(argumentType, context);
            }else if( acceptType.isLiteralArrayType ){
                const arrayType = this.getGlobalTypeById('array');
                return arrayType.is(argumentType);
            }else if( acceptType.isUnionType ){
                if( argumentType.isUnionType ){
                    return true;
                }
                return acceptType.elements.some( base=>{
                    const acceptType = base.type();
                    return this.checkMatchType(argumentType, null, acceptType, context)
                });
            }else if( acceptType.isIntersectionType ){
                return this.checkMatchType(argumentType, null, acceptType.left, context) && this.checkMatchType(argumentType, null, acceptType.right, context);
            }else if( acceptType.isAliasType ){
                return this.checkMatchType(argumentType, null, acceptType.inherit, context)
            }
            if( !acceptType.is(argumentType, context) ){
                return false
            }
        }
        return true;
    }

    getMatchDescriptor(property, classModule, isStatic=false, onlyAccessProperty=false){
        if(!property || !classModule || !(classModule.isModule || classModule.isNamespace))return null;
        if(classModule.isClassGenericType && classModule.isClassType){
            return this.getMatchDescriptor(property, type.types[0], true);
        }

        let args = null;
        let assigments = null;
        let pStack = this;
        let isCall = this.isCallExpression;
        let isNew = this.isNewExpression;
        let isSet  = this.isAssignmentExpression || (this.parentStack.isAssignmentExpression && this.parentStack.left === this)
        if(!isCall && this.parentStack.isCallExpression && this.parentStack.callee === this){
            isCall = true;
            pStack = this.parentStack;
        }

        if( onlyAccessProperty ){
            isCall = false;
            isNew = false;
            isSet = false;
        }

        if( isCall || isNew){
            isCall = true;
            args = pStack.arguments || [];
            assigments = pStack.genericity;
        }

        const checkMatchFun = (params, declareGenerics)=>{
            if( params.length === args.length && args.length === 0 ){
                return true;
            }else if( params.length >= args.length){
               
                if(assigments && assigments.length>0){
                    if( !declareGenerics )return false;
                    if( declareGenerics.length < assigments.length )return false;
                }
                
                return params.every( (declare,index)=>{
                    const argument = args[index];
                    const optional = !!(declare.question || declare.isAssignmentPattern || declare.isRestElement);
                    if( argument ){
                        let acceptType = declare.type();
                        if( declareGenerics && assigments && acceptType && acceptType.isGenericType ){
                            for(let i=0; i<declareGenerics.length;i++){
                                if( acceptType === declareGenerics[i].type() ){
                                    if( assigments[i] ){
                                        acceptType = assigments[i].type();
                                    }
                                    break;
                                }
                            }
                        }
                        let ctx={};
                        if(acceptType && acceptType.isClassGenericType ){
                            ctx = new Context(this);
                            ctx.assignment(acceptType); 
                        }
                        return this.checkMatchType(argument, declare, acceptType, ctx)
                    }
                    return optional;
                });
            }
            return false;
        };

        const filter = (desc, prev, index, descriptors, extendsContext)=>{
            const isStaticDesc = desc.callableStatic || Utils.isStaticDescriptor(desc);
            if(isStatic){
                if( !isStaticDesc ){
                    if( !extendsContext || !extendsContext.callableStatic )return false;
                }
            }else if( isStaticDesc ){
                return false;
            }

            //不能直接作为结果返回，可能有覆盖的成员描述
            // if( descriptors && descriptors.length===1 ){
            //    return true;
            // }

            if( isCall ){

                if( desc.isEnumProperty || desc.isMethodSetterDefinition)return false;
                let params = null;
                let generics = null;
                if( desc.isMethodDefinition && !desc.isMethodGetterDefinition || desc.isDeclaratorFunction ){
                    if( isNew ){
                        if( !desc.isConstructor )return false; 
                    }
                    generics = desc.genericity ? desc.genericity.elements : [];
                    params = desc.params || [];
                    if( checkMatchFun(params, generics) ){
                        return true;
                    } 
                }else if(desc.isPropertyDefinition || desc.isMethodGetterDefinition || desc.isDeclaratorVariable){
                    const type = desc.type();
                    if( type ){
                        if( isNew ){
                            if( type.isClassGenericType && type.isClassType ){
                                return true;
                            }
                        }else if( type.isFunctionType ){
                            generics = type.generics;
                            params = type.params || [];
                            if( checkMatchFun(params, generics) ){
                                return true
                            }
                        }
                    }
                }

                if( prev ){
                    let pParamLen = 0;
                    let pGenericsLen = 0;
                    let cParamLen = params ? params.length : 0;
                    let cGenericsLen = generics && generics.length;
                    if( prev.isMethodDefinition && !prev.isAccessor ){
                        pParamLen = prev.params.length;
                        pGenericsLen = prev.genericity ? prev.genericity.elements.length : 0;
                    }else if( prev.isPropertyDefinition || prev.isMethodGetterDefinition ){
                        const type = prev.type();
                        if( type.isFunctionType ){
                            pParamLen = (type.params || []).length;
                            pGenericsLen = type.generics.length; 
                        }
                    }

                    if( isCall ){
                        if( cParamLen === args.length && pParamLen !== args.length ){
                            return desc;
                        }else if( pParamLen === args.length && cParamLen !== args.length ){
                            return prev;
                        }

                        if( args.length === 0 ){
                            if( pParamLen > cParamLen ){
                                return desc;
                            }else if( cParamLen > pParamLen ){
                                return prev;
                            }
                        }

                        if( assigments ){
                            if( cGenericsLen === assigments.length && pGenericsLen !== assigments.length){
                                return desc;
                            }else if( pGenericsLen === assigments.length && cGenericsLen !== assigments.length ){
                                return prev;
                            }
                        }else{
                            if( !cGenericsLen && pGenericsLen){
                                return desc;
                            }else if( !pGenericsLen && cGenericsLen){
                                return prev;
                            }
                        }
                    }
                   
                    if( cParamLen > pParamLen ){
                        return desc;
                    }

                    if( cGenericsLen > pGenericsLen ){
                        return desc;
                    }
                }

            }else if( isSet ){
                if( desc.isEnumProperty )return false;
                if( desc.isMethodSetterDefinition ){
                    return true;
                }else if( desc.isPropertyDefinition ){
                    if( !desc.isReadonly ){
                        return true;
                    }
                }

            }else{
                if( desc.isMethodGetterDefinition || desc.isPropertyDefinition || desc.isEnumProperty){
                    return true;
                }
            }

            return prev || desc;
        }

        return classModule.getDescriptor(property, filter);
    }

    getObjectDescriptor(object, property, isStatic=false, prevObject=null, context=null){
        if(!object)return null;
        if( !(object instanceof Type) ){
            throw new Error('Argument object is not type');
        }

        const ctx = context || this.getContext();
        object = ctx.fetch(object.type(), true);

        

        if(object === prevObject){
            return Namespace.globals.get('any');
        }

        if( object.isComputeType ){
            object = object.getResult();
        }

        if( object.isAnyType )return Namespace.globals.get('any');
        
        if( object.isAliasType ){
            return this.getObjectDescriptor(object.inherit.type(), property, isStatic, object, context);
        }

        if(object.isClassGenericType){
            if(object.isClassType){
                return this.getObjectDescriptor(object.types[0].type(), property, true, object, context)
            }else{
                const wrap = object.inherit.type();
                if( wrap.target && wrap.target.isDeclaratorTypeAlias && wrap.target.genericity ){
                    const declareGenerics = wrap.target.genericity.elements;
                    if(object.elements.length===1 && declareGenerics.length === 1){
                        const has = declareGenerics[0].type() === wrap.inherit.type();
                        if( has ){
                            return this.getObjectDescriptor(object.elements[0].type(), property, false, object, context);
                        }
                    }
                    const ctx = new Context(this);
                    ctx.make(object);
                    return this.getObjectDescriptor(wrap.inherit.type(), property, false, object, ctx);
                }
            }
        }

        if( object.isIntersectionType ){
            return this.getObjectDescriptor(object.left.type(), property, isStatic, object, context) || 
                    this.getObjectDescriptor(object.right.type(), property, isStatic, object, context);
        }

        let dynamicAttribute = false;
        let result = null;
        if( object.isUnionType ){
            const properties = [];
            const elems = object.elements;
            const checkCall = (stack)=>{
                if(!stack)return false;
                return (stack.isCallExpression || stack.isNewExpression) && stack.callee === this;
            }
            const isCall = checkCall(this) || checkCall(this.parentStack);
            const isTypeDefinition = (stack)=>{
                return stack.isTypeObjectPropertyDefinition || 
                    stack.isPropertyDefinition || 
                    stack.isMethodGetterDefinition;
            };
            for(let i=0;i<elems.length;i++){
                const item = elems[i];
                const result = this.getObjectDescriptor(item.type(), property, isStatic, object, context);
                if( result ){
                    if(isCall){
                        if( (result.isMethodDefinition && !result.isAccessor) || result.isFunctionExpression){
                            return result
                        }else if( result.isPropertyDefinition || result.isMethodGetterDefinition ){
                            const type = result.type();
                            if( type.isFunctionType ){
                                return result;
                            }
                        }
                    }else{
                        if( isTypeDefinition(result) ){
                            return result;
                        }
                        properties.push(result);
                    }
                }
            }
            if( properties.length > 0 ){
                if( properties.length===1 ){
                    return properties[0];
                }else{
                    const mergeType = new MergeType();
                    properties.forEach( item=>{
                        mergeType.add( item )
                    });
                    return mergeType.type();
                }
            }
            return null;
        }else if( this.isLiteralObject(object) ){
            dynamicAttribute = true;
            let desc = object.attribute(property);
            if(desc){
                return desc;
            }
        }

        const origin = Utils.getOriginType(object);
        result = this.getMatchDescriptor(property, origin, isStatic);
        if( !result ){
            result = this.getObjectDynamicDescriptor( dynamicAttribute ? object : origin, object.isLiteralArrayType || object.isTupleType ? 'number' : 'string' )
        }

        if( !result && object.isLiteralObjectType && object.target && object.target.isObjectExpression){
            if( !this.compiler.options.literalObjectStrict ){
                result = Namespace.globals.get('any');
            }
        }

        return result || null;
    }

    getObjectDescriptorForAuxiliary(object, property, isStatic=false, prevObject=null, context=null){
        if(!object)return null;
        if( !(object instanceof Type) ){
            throw new Error('Argument object is not type');
        }

        const ctx = context || this.getContext();
        object = ctx.fetch(object.type(), true);

        if(object === prevObject){
            return null
        }

        if( object.isComputeType ){
            object = object.getResult();
        }
        if( object.isAnyType )return null;
        if( object.isAliasType ){
            return this.getObjectDescriptorForAuxiliary(object.inherit.type(), property, isStatic, object, context);
        }
        if(object.isClassGenericType){
            if(object.isClassType){
                return this.getObjectDescriptorForAuxiliary(object.types[0].type(), property, true, object, context)
            }else{
                const wrap = object.inherit.type();
                if( wrap.target && wrap.target.isDeclaratorTypeAlias && wrap.target.genericity ){
                    const declareGenerics = wrap.target.genericity.elements;
                    if(object.elements.length===1 && declareGenerics.length === 1){
                        const has = declareGenerics[0].type() === wrap.inherit.type();
                        if( has ){
                            return this.getObjectDescriptorForAuxiliary(object.elements[0].type(), property, false, object, context);
                        }
                    }
                    const ctx = new Context(this);
                    ctx.make(object);
                    return this.getObjectDescriptorForAuxiliary(wrap.inherit.type(), property, false, object, ctx);
                }
            }
        }
        if( object.isIntersectionType ){
            return this.getObjectDescriptorForAuxiliary(object.left.type(), property, isStatic, object, context) || 
                    this.getObjectDescriptorForAuxiliary(object.right.type(), property, isStatic, object, context);
        }
        let dynamicAttribute = false;
        let result = null;
        if( object.isUnionType ){
            const elems = object.elements;
            for(let i=0;i<elems.length;i++){
                const item = elems[i];
                const result = this.getObjectDescriptorForAuxiliary(item.type(), property, isStatic, object, context);
                if( result ){
                    return result;
                }
            }
            return null;
        }else if( this.isLiteralObject(object) ){
            dynamicAttribute = true;
            let desc = object.attribute(property);
            if(desc){
                return desc;
            }
        }
        const origin = Utils.getOriginType(object);
        if( origin.isModule ){
            if( isStatic ){
                result = origin.getMethod(property)
            }else{
                result = origin.getMember(property)
            }
        }
        if( !result ){
            result = this.getObjectDynamicDescriptor( dynamicAttribute ? object : origin, object.isLiteralArrayType || object.isTupleType ? 'number' : 'string' )
        }
        return result;
    }

    isLiteralObject(object){
        if(!object)return false;
        if( object.isLiteralArrayType || object.isTupleType || object.isLiteralObjectType || (object.isGenericType && object.hasConstraint) || object.isEnumType ){
            return true;
        }
        return false;
    }

    getObjectDynamicDescriptor(object, propertyType){
        if( this.isLiteralObject(object) || Utils.isTypeModule(object) ){
            const type = Namespace.globals.get( propertyType )
            if( object.isGenericType ){
                object = object.inherit.type();
            }
            return object.dynamicAttribute(type);
        }
        return null;
    }

    isTypeInContextType(type, contextType){
        if( !contextType || !type)return false;
        if( type === contextType ){
            return true;
        }else if( contextType.isClassGenericType ){
            return contextType.types.some( item=>this.isTypeInContextType(type, item.type() ) );
        }else if( contextType.isFunctionType ){
            const declReturnType = contextType.returnType;
            if( declReturnType && this.isTypeInContextType(type, declReturnType.type() ) )return true;
            if( contextType.params.some( item=>this.isTypeInContextType(type, item.type() ) ) )return true;
        }else if( contextType.isTupleType || contextType.isLiteralArrayType || contextType.isUnionType){
            return contextType.elements.some( item=>this.isTypeInContextType( type, item.type() ) );
        }else if( contextType.isLiteralObjectType ) {
            if( contextType.properties.some( item=>this.isTypeInContextType( type, item.type() ) ) )return true;
            if( type.dynamicProperties ){
                const properties = Array.from(type.dynamicProperties.values());
                if( properties.some( item=>this.isTypeInContextType( type, item.type() ) ) )return true;
            }
        }else if( type.isIntersectionType ){
            if( this.isTypeInContextType(type, type.left.type() ) )return true;
            if( this.isTypeInContextType(type, type.right.type() ) )return true;
        }else if( type.isAliasType ){
            if( this.isTypeInContextType(type, type.inherit.type() ) )return true;
        }
        return false;
    }

    isTypeDefinitionStack(stack){
        if(!stack)return false;
        return stack.isTypeDefinition || 
                stack.isTypeTupleRestDefinition || 
                stack.isTypeTupleDefinition || 
                stack.isTypeGenericDefinition ||
                stack.isTypeObjectDefinition || 
                stack.isTypeObjectPropertyDefinition || 
                stack.isTypeFunctionDefinition || 
                stack.isTypeComputeDefinition || 
                stack.isTypeIntersectionDefinition || 
                stack.isTypeKeyofDefinition || 
                stack.isTypeTypeofDefinition || 
                stack.isTypeUnionDefinition;
    }

    isModuleForWebComponent(module){
        if( !(module && module.isModule && module.isClass) ){
            return false;
        }
        return module.isWebComponent();
    }

    isModuleForSkinComponent(module){
        if( !(module && module.isModule && module.isClass) ){
            return false;
        }
        return module.isSkinComponent();
    }

    isJSXForContext(stack){
        stack = stack || this.parentStack;
        if( stack.isSequenceExpression )stack = stack.parentStack;
        if( stack.isParenthesizedExpression )stack = stack.parentStack;
        if( stack.isLiteral || stack.isJSXExpressionContainer)stack = stack.parentStack;
        if( stack.isJSXAttribute )stack = stack.jsxElement;
        if( stack.isMemberExpression )return this.isJSXForContext(stack.parentStack);
        return !!(stack.jsxElement && stack.scope.isForContext);
    }

    isJSXForRef(stack){
        stack = stack || this.parentStack;
        if( stack.isLiteral || stack.isJSXExpressionContainer)stack = stack.parentStack;
        if( stack.isJSXAttribute )stack = stack.jsxElement;
        if( stack.isMemberExpression )return this.isJSXForRef(stack.parentStack);
        return !!(stack.jsxElement && stack.scope.isForContext);
    }

    getAnnotationArgumentItem(name, args, indexes=null){
        name = String(name).toLowerCase()
        let index = args.findIndex(item=>{
            const key = String(item.key).toLowerCase();
            return key===name;
        });
        if( index < 0 && indexes && Array.isArray(indexes)){
            index = indexes.indexOf(name);
            if( index>= 0 ){
                const arg = args[index];
                return arg && !arg.assigned ? arg : null;
            }
        }
        return args[index];
    }

    findAnnotation(stack, filter, inheritFlag=true){
        if(arguments.length===1){
            filter = stack;
            stack = this;
        }else if(arguments.length===2 && typeof filter ==='boolean'){
            inheritFlag = filter;
            filter = stack;
            stack = this;
        }
        if( stack && stack.isModule && stack instanceof Module){
            const items = stack.getStacks();
            for(let i=0;i<items.length;i++){
                const result = this.findAnnotation(items[i], filter);
                if(result){
                    return result;
                }
            }
            return null;
        }

        if( !stack || !stack.isStack ){
            return null
        }

        const each = (list, invoke)=>{
            if( !list )return null;
            let len = list.length;
            let i=0;
            for(;i<len;i++){
                const result = invoke( list[i] );
                if( result ){
                    return result;
                }
            }
            return null;
        }
        
        let result = each(stack.annotations, (annotation)=>{
            const result = filter(annotation, stack);
            if( result ){
                return [result, stack];
            }
        });

        if( result ){
            return result;
        }

        if( inheritFlag===false ){
            return null;
        }
        
        if( stack.isClassDeclaration || stack.isDeclaratorDeclaration || stack.isInterfaceDeclaration || stack.isEnumDeclaration ){
            const module = stack.module;
            const impls = module.extends.concat( module.implements || [] );
            return each( impls, (module)=>{
                const result = this.findAnnotation(module, filter, inheritFlag);
                if( result ){
                    return result;
                }
            });
        }else if( (stack.isMethodDefinition || stack.isPropertyDefinition) && !stack.static ){
            const module = stack.module;
            const name = stack.value();
            const impls = module.extends.concat( module.implements || [] );
            const token = stack.toString();
            const isStatic = !!stack.static;
            return each( impls, (module)=>{
                const descriptors = module.descriptors.get(name);
                if(descriptors){
                    for(let i=0; i<descriptors.length;i++){
                        const stack = descriptors[i];
                        if(stack && token === stack.toString() && isStatic === !!stack.static ){
                            const result = this.findAnnotation(stack, filter, inheritFlag);
                            if( result ){
                                return result;
                            }
                        }
                    }
                }
            });
        }
        return null;
    }
    
    getFunType(){
        return null;
    }

    value(){
        return this.node.name || this.node.value;
    }

    raw(){
        if( this.compilation && this.compilation.source ){
           return this.compilation.source.substr(this.node.start, this.node.end - this.node.start);
        }
        return this.node.raw || this.node.name;
    }
    
    checker(){
        if( this.__checked )return false;
        return this.__checked = true;
    }
    
    parser(){
        if( this.__parsered )return false;
        return this.__parsered = true;
    }

    parserDescriptor(desc){
        // if(!desc)return;
        // if(desc.isStack){
        //     if(desc.isMethodDefinition || desc.isPropertyDefinition){
        //         if(desc.module){
        //             this.parserDescriptor(desc.module);
        //         }
        //         desc.parentStack.parser();
        //     }else{
        //         desc.parser();
        //     }
        // }else if(desc.isModule){
        //     const stack = desc.moduleStack;
        //     if(stack){
        //         stack.parser();
        //     }
        // }
    }

    setRefBeUsed( description ){
        const desc = description || this.description();
        if( desc && desc instanceof Stack && desc !== this ){
            desc.addUseRef( this );
        }else if( desc && Utils.isTypeModule( desc ) ){
            const classStack = this.compilation.getStackByModule(desc);
            if(classStack && classStack !== this ){
                classStack.addUseRef( this );
            }
            if( !(this.parentStack.isTypeDefinition || this.parentStack.isTypeGenericDefinition || this.parentStack.isVariableDeclarator) ){
                this.compilation.addDependency(desc, this.module);
            }
        }
    }
    interceptAnnotation( stack ){
        if( !(stack && stack.isAnnotationDeclaration) ){
            return stack;
        }
        const aName = stack.name.toLowerCase();
        if( aName ==="hostcomponent" && this.isJSXScript ){
            this.hostComponentAnnotation = stack;
            return null;
        }
        else if( aName ==="require" ){
            return null;
        }
        else if( aName ==="reference" ){
            if( !(stack.parentStack && ( stack.parentStack.isProgram || stack.parentStack.isPackageDeclaration )) ){
                stack.error(1105, this.name);
            }
            return null;
        }
        return stack;
    }

    freeze( target ){
        Object.freeze( target || this);
    }
    error(code, ...args){
        this.compilation.error(this.node, code,...args);
    }
    warn(code, ...args){
        this.compilation.warn(this.node,code,...args);
    }
    toString(){
        return 'Stack';
    }

    async allSettled(items, asyncMethod, fetchResult=false){
        if(!items)return;
        if(!Array.isArray(items)){
            console.error('Stack.allSettled items invalid.')
            return false;
        }
        try{
            const results = await Promise.allSettled(items.map((item,index)=>asyncMethod(item,index,items)));
            if(fetchResult){
                return results.map(promise=>{
                    if(promise.status === 'rejected'){
                        console.error(promise.reason);
                    }
                    return promise.status === 'fulfilled'? promise.value : null;
                });
            }
        }catch(e){
            return false;
        }
        
    }

    async callParser(callback, nowInvokeFlag=false){
        if(this.__parsered && !nowInvokeFlag)return false;
        try{
            this.__parsered = true;
            await callback();
        }catch(e){
            console.error(e);
        }
        return true;
    }
}


module.exports = Stack;
