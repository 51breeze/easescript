const Utils = require("./Utils");
const EventDispatcher = require("./EventDispatcher.js");
const MergeType = require("./MergeType");
const Module = require("./Module");
const Type = require("../types/Type");
const Context = require("./Context");
const Namespace = require("./Namespace");
const Specifier = require("./Specifier");
const JSModule = require("./JSModule");
const Predicate = require("./Predicate");
const AutoImporter = require("./AutoImporter");
const keySymbol = Symbol('key');
const mergeArrayKey = Symbol('key');
const emptyOnlyreadArray = [];
const NOT_ASSING_GENERICS = 1;
const MISSING_ASSING_GENERICS = 1 << 1;
const FAILED_ASSING_GENERICS = 1 << 2;
const DESCRIPTOR_TYPE_UNMATCH = 1 << 3;
const FUN_TYPE_PARAMS_UNMATCH = 1 << 4;
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
            comments:null,
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
        }
    }

    is(value){
        return value ? value instanceof Stack : false;
    }

    get comments(){
        if(!this.compiler.options.enableComments)return [];
        const comments = this[keySymbol].comments;
        if(comments)return comments;
        const type = this.node.type;
        switch(type){
            case 'DeclaratorTypeAlias' :
            case 'DeclaratorFunction' :
            case 'DeclaratorVariable' :
            case 'PackageDeclaration' :
            case 'ClassDeclaration' :
            case 'DeclaratorDeclaration' :
            case 'InterfaceDeclaration' :
            case 'EnumDeclaration' :
            case 'StructTableDeclaration' :
            case 'MethodDefinition' :
            case 'PropertyDefinition' :
                return this[keySymbol].comments = this.findComments() || [];
        }
        return [];
    }
    
    findComments(latter=false){
        let stack =this;
        let prev = stack;
        let parent = stack.parentStack;
        let index = -1;
        // let isBlock = false;
        // while(parent){
        //     if(parent.isBlockStatement || parent.isProgram || parent.isPackageDeclaration){
        //         isBlock = stack.parentStack === parent;
        //         break;
        //     }
        //     prev = parent;
        //     parent = parent.parentStack;
        // }
        if(parent){
            const testSkipAnnotation = (index)=>{
                if(latter){
                    if(index < parent.childrenStack.length){
                        const node = parent.childrenStack[index+1];
                        if(node.isAnnotationDeclaration){
                            return testSkipAnnotation(index+1);
                        }
                    }
                }else{
                    if(index > 0){
                        const node = parent.childrenStack[index-1];
                        if(node.isAnnotationDeclaration){
                            return testSkipAnnotation(index-1);
                        }
                    }
                }
                return index;
            }

            let restrict = latter ? parent.node.end : parent.node.start;
            index = parent.childrenStack.indexOf(prev);
            
            if( index>=0 ){
                index = testSkipAnnotation(index);
                if(latter){
                    if(index < parent.childrenStack.length){
                        restrict = parent.childrenStack[index+1].node.start;
                    }
                }else if(index>0){
                    restrict = parent.childrenStack[index-1].node.end;
                }
                return this.compilation.emitComments.filter(comment=>{
                    if(latter){
                        return stack.node.end < comment.start && comment.end < restrict;
                    }else{
                        return restrict < comment.start && comment.end < stack.node.start;
                    }
                });
            }
        }
        return null;
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

    getAttribute(name, initCallback=null, key=null){
        const data = this[keySymbol].attributes;
        if(key){
            data[name] = new Map();
        }
        if(initCallback){
            const has = key ? data[name].has(key) : Object.prototype.hasOwnProperty.call(data, name);
            const value = !has ? initCallback() : key ? data[name].get(key) : data[name];
            if(!has && value !== void 0){
                if(key){
                    data[name].set(key, value)
                }else{
                    data[name] = value;
                }
            }
            return value;
        }
        if(key){
            return data[name].get(key)
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
        if(this.compilation.hasDeclareJSModule){
            let pp = this.getParentStack(stack=>stack.isModuleDeclaration && stack.module)
            if(pp.isModuleDeclaration && pp.module){
                const type = pp.module.getType(id);
                if(type){
                    return type;
                }
            }
        }
        let type = this.scope.define(id);
        if(type){
            if(type.isImportDeclaration)type = type.description();
            if(Utils.isTypeModule(type))return type;
        }
        context = context||this.module||this.namespace
        return this.compilation.getModuleById(id, context);
    }

    hasModuleById(id, context){
        if(this.compilation.hasDeclareJSModule){
            let pp = this.getParentStack(stack=>stack.isModuleDeclaration && stack.module)
            if(pp.isModuleDeclaration && pp.module){
                if(pp.module.types.has(id)){
                    return false;
                }
            }
        }
        let type = this.scope.define(id);
        if(type){
            return true;
        }
        context = context||this.module||this.namespace
        return this.compilation.hasModuleById(id, context);
    }

    checkNeedToLoadTypeById(id, context){
        if(this.compilation.hasDeclareJSModule){
            let pp = this.getParentStack(stack=>stack.isModuleDeclaration && stack.module)
            if(pp.isModuleDeclaration && pp.module){
                if(pp.module.types.has(id)){
                    return false;
                }
            }
        }
        let type = this.scope.define(id);
        if(type){
            return false;
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
        }else if(this.isFunctionExpression || this.isArrayExpression || this.isObjectExpression){
            let stack = this.parentStack;
            if( stack.isMethodDefinition ){
                const module = this.parentStack.module;
                if(module){
                    parent = module.moduleStack;
                }
            }else{
                while( stack && (stack.isProperty || stack.isObjectExpression || stack.isArrayExpression)){
                    stack = stack.parentStack;
                }
                if( stack.isCallExpression || stack.isNewExpression || stack.isVariableDeclarator || stack.isAssignmentExpression){
                    parent = stack;
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
        }else if(this.parentStack && (this.parentStack.isArrayExpression || this.parentStack.isObjectExpression)){
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

    definitionMergeToArray(defs, append=null){
        if(!Array.isArray(defs)){
            if(!defs){
                if(append)return [append];
                return [];
            }else{
                defs = [defs];
            }
        }else{
            defs = defs.filter(Boolean);
        }
        let expre = '';
        let comments = [];
        if(append){
            defs.push(append)
        }
        let cache = {};
        defs.forEach( item=>{
            let text = String(item.text||item.expre).trim();
            let prefix = item === append || text.charCodeAt(0) ===40 ? '' : '(alias) ';
            if(item[mergeArrayKey]){
                expre = prefix+text+ '\n';
                comments = item.comments
                return;
            }
            if(!cache[text]){
                expre += prefix+text+ '\n';
                cache[text] = true;
            }
            if(item.comments){
                if(Array.isArray(item.comments)){
                    comments.push( ...item.comments )
                }
            }
        });
        expre = expre.trim();
        let selection = append ? append.selection || append.range : null;
        return defs.map(item=>{
            return {
                expre,
                text:expre,
                comments,
                selection,
                location:item.location,
                file:item.file,
                kind:item.kind,
                [mergeArrayKey]:true
            }
        });
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

    descriptor(desc=null){
        desc = desc || this.description();
        if(desc && desc !== this && this.is(desc)){
            return desc.descriptor();
        }
        return desc;
    }

    getDescriptorOwner(desc){
        if(!desc)return null;
        let object = desc.module || desc.namespace;
        if(object && (Module.is(object) || Namespace.is(object))){
            return object;
        }
        if(desc.isType && desc.target){
            return this.getDescriptorOwner(desc.target);
        }
        return null;
    }

    type(){
        return null;
    }

    getReferenceType(){
        if(this.isIdentifier){
            let isMemberExpression = false;
            if(this.parentStack.isMemberExpression){
                isMemberExpression = true;
                if(this.parentStack.object!==this){
                    return null
                }
            }
            let id = this.value();
            let desc = this.scope.define(id);
            if(desc && desc.isDeclaratorVariable){
                if(JSModule.is(desc.module)){
                    desc = desc.module.getType(id);
                }else{
                    desc = desc.namespace.modules.get(id);
                }
            }
            if(desc && isMemberExpression){
                if(!(desc.isImportNamespaceSpecifier || desc.isImportSpecifier || desc.isImportDefaultSpecifier)){
                    desc = null;
                }
            }
            if(desc){
                if(isMemberExpression){
                    let _desc = this.getImportedType(desc, true);
                    if(_desc)return _desc;
                    _desc =this.getTypeFromJSModule(desc.module, id, isMemberExpression, true)
                    if(_desc)return _desc;
                }else{
                    if( desc.isGenericTypeDeclaration           || 
                        desc.isGenericTypeAssignmentDeclaration || 
                        desc.isTypeStatement                    || 
                        desc.isDeclaratorTypeAlias              || 
                        (desc.isEnumDeclaration && desc.isExpressionDeclare)
                    ){
                        if(this.parentStack.isTypeDefinition || this.parentStack.isTypeGenericDefinition){
                            return desc;
                        }
                        return desc.type();
                    }
                    if(Type.is(desc))return desc;
                    desc = this.getImportedType(desc);
                    if(desc)return desc;
                }
                return null;
            }else{
                if(this.compilation.hasDeclareJSModule){
                    let pp = this.getParentStack(stack=>stack.isModuleDeclaration && stack.module)
                    if(pp.isModuleDeclaration && pp.module){
                        if(isMemberExpression){
                            const ns = pp.module.namespaces.get(id) || JSModule.getModuleFromNamespace(id);
                            if(ns){
                                return ns;
                            }
                        }
                        const type = this.getTypeFromJSModule(pp.module, id, isMemberExpression, true);
                        if(type){
                            return type;
                        }
                    }
                }
                if(isMemberExpression){
                    return Namespace.fetch(id, null, true);
                }else{
                    return this.compilation.getModuleById(id, this.module||this.namespace);
                }
            }
           
        }else if(this.isMemberExpression){
            if(!this.parentStack.isMemberExpression){
                const type = JSModule.getType(this.value());
                if(type){
                    return type;
                }
            }
            let description = this.object.getReferenceType();
            if(!description)return null;
            let property = this.property.value();
            if(Namespace.is(description)){
                if(this.parentStack.isMemberExpression){
                    return description.children.get(property);
                }
                return description.modules.get(property);
            }else{
                return this.getTypeFromJSModule(description.isNamespaceDeclaration ? description.module : description, property, !!this.parentStack.isMemberExpression);
            }
        }
        return null;
    }

    getTypeFromJSModule(object, property, isNs, isRefs = false){
        if(!JSModule.is(object))return null;
        if(isNs){
            let nsModule = object.namespaces.get(property);
            if(nsModule)return nsModule;
            let desc = object.getExport(property);
            if(!desc)return null;
            if(desc && desc.isNamespaceDeclaration)return desc.module;
            if(desc.isImportDefaultSpecifier || desc.isImportNamespaceSpecifier || desc.isImportSpecifier){
                desc = desc.description();
            }
            if(JSModule.is(desc))return desc;
        }else{
            let desc = object.getType(property) || object.getExport(property)
            if(desc){
                if(this.is(desc))desc = desc.type();
                if(Type.is(desc))return desc;
            }
        }
        return null;
    }

    getImportedType(object, allowNs=false){
        if(!object)return null;
        if(!allowNs && object.isImportDeclaration){
            return object.description();
        }
        if(object.isImportNamespaceSpecifier || object.isImportSpecifier || object.isImportDefaultSpecifier){
            let desc = object.descriptor();
            if(desc){
                if(allowNs){
                    if(desc.isNamespaceDeclaration){
                        return desc;
                    }else if(desc.isExportAssignmentDeclaration){
                        const object = desc.getExportNamespace();
                        if(object){
                            return object;
                        }
                    }else if(JSModule.is(desc)){
                        return desc;
                    }
                }else{
                    const _type = desc.type();
                    if(Type.is(_type)){
                        return _type;
                    }
                }
            }
        }
        return null;
    }

    getReferenceModuleType(){
        const type = this.getReferenceType();
        if(type && Module.is(type)){
            return type;
        }
        return null;
    }

    hasLocalReferenceType(id){
        return this.getAttribute('hasLocalReferenceType:'+id,()=>{
            if(this.compilation.hasDeclareJSModule){
                let pp = this.getParentStack(stack=>stack.isModuleDeclaration)
                if(pp.isModuleDeclaration){
                    const type = pp.module.getType(id);
                    if(type){
                        return true;
                    }
                }
            }
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
            // if(acceptType && acceptType.isClassGenericType ){
            //     const wrap = acceptType.inherit.type();
            //     if(argumentType.isClassGenericType){
            //         return wrap.is(acceptType.inherit.type()); 
            //     }
            //     if( wrap && wrap.target && wrap.target.isDeclaratorTypeAlias && wrap.target.genericity ){
            //         acceptType = wrap.inherit.type();
            //     }
            // }
            if( acceptType.isGenericType && context && context.isContext && context instanceof Context){
                acceptType = context.fetch(acceptType, true);
            }
            if( acceptType.isGenericType ){
                if(acceptType.hasConstraint){
                    const constraint = acceptType.inherit.type();
                    if(constraint !== acceptType){
                        let _ctx = declareParam.getContext?.().createChild(argumentStack);
                        return this.checkMatchType(argumentStack, declareParam, constraint, _ctx);
                    }
                }
                return true;
            }else if( acceptType.isFunctionType ){
                if(!argumentType.isFunctionType)return false;
                let last = acceptType.params[acceptType.params.length-1];
                let hasRest = last && last.isRestElement ? true : false;
                if(argumentType.params.length>acceptType.params.length && !hasRest)return false;
                return acceptType.params.every((decl,index)=>{
                    const assign = argumentType.params[index];
                    if(assign)return true;
                    return !!(decl.isAssignmentPattern || decl.question || decl.isRestElement)
                });
            }else if( acceptType.isLiteralObjectType ){
                return acceptType.constraint(argumentType, context);
            }else if( acceptType.isLiteralArrayType ){
                const arrayType = this.getGlobalTypeById('array');
                return arrayType.is(argumentType);
            }
            // else if( acceptType.isUnionType ){
            //     if( argumentType.isUnionType ){
            //         return true;
            //     }
            //     return acceptType.elements.some( base=>{
            //         const acceptType = base.type();
            //         return this.checkMatchType(argumentType, null, acceptType, context)
            //     });
            // }else if( acceptType.isIntersectionType ){
            //     return this.checkMatchType(argumentType, null, acceptType.left, context) && this.checkMatchType(argumentType, null, acceptType.right, context);
            // }else if( acceptType.isAliasType ){
            //     return this.checkMatchType(argumentType, null, acceptType.inherit, context)
            // }
            if( !acceptType.is(argumentType, context) ){
                return false
            }
        }
        return true;
    }

    getMatchDescriptor(property, classModule, isStatic=false, onlyAccessProperty=false){

        if(!property || !classModule || !(classModule.isModule || classModule.isNamespace || JSModule.is(classModule) ||
            classModule.isUnionType && property==='#match-union-type' || 
            classModule.isLiteralObjectType && (property==='#new#' || property==='#call#')
        ))return null;

        if(classModule.isClassGenericType && classModule.isClassType){
            return this.getMatchDescriptor(property, type.types[0], true);
        }
        let args = null;
        let assigments = null;
        let pStack = this;
        let isCall = !!this.isCallExpression;
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
            args = pStack.arguments || emptyOnlyreadArray;
            assigments = pStack.genericity || emptyOnlyreadArray;
        }

        let incompleteFlag = 0;
        let matchResult = false;
        const checkMatchFun = (params, declareGenerics, desc)=>{
            incompleteFlag = 0;
            matchResult = false;
            if( params.length === args.length && args.length === 0 ){
                return matchResult = true;
            }else if( params.length >= args.length){
                if(assigments.length>0){
                   if(declareGenerics.length < assigments.length )incompleteFlag=FAILED_ASSING_GENERICS;
                   if(declareGenerics.length > assigments.length )incompleteFlag=MISSING_ASSING_GENERICS;
                }else if(declareGenerics.length>0){
                    incompleteFlag = NOT_ASSING_GENERICS;
                }
                if(!isNew && desc.isConstructor){
                    incompleteFlag |=  DESCRIPTOR_TYPE_UNMATCH;
                }
                matchResult = params.every( (declare,index)=>{
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
                        
                        if(this.checkMatchType(argument, declare, acceptType, ctx)){
                            return true;
                        }else{
                            if(acceptType.isFunctionType && argument.type().isFunctionType){
                                incompleteFlag |=  FUN_TYPE_PARAMS_UNMATCH;
                            }
                            return false;
                        }
                    }
                    return optional;
                });
                return matchResult && incompleteFlag === 0;
            }
            return false;
        };

        let target = null;
        const records = [];
        const update = (desc, params, generics)=>{
            records[0] = desc;
            records[1] = params;
            records[2] = generics;
            records[3] = matchResult;
            records[4] = incompleteFlag;
            return records;
        }
        const calcScore=(result, params, generics, incompleteFlag,desc)=>{
            let score = result ? 500 : 0;
            if( incompleteFlag === -1 ){
               return -1
            }
            if(assigments && assigments.length >0){
                score+= generics.length;
            }
            if((NOT_ASSING_GENERICS & incompleteFlag) === NOT_ASSING_GENERICS){
                score -= generics.length
                for(let i=0;i<generics.length;i++){
                    const decl = generics[i].type();
                    if(decl.assignType){
                        score += generics.length-i
                        break;
                    }
                }
            }

            if((FUN_TYPE_PARAMS_UNMATCH & incompleteFlag) === FUN_TYPE_PARAMS_UNMATCH){
                score += 1;
            }

            if((MISSING_ASSING_GENERICS & incompleteFlag) === MISSING_ASSING_GENERICS){
                score -= generics.length - assigments.length;
            }
            if((FAILED_ASSING_GENERICS & incompleteFlag) === FAILED_ASSING_GENERICS){
                score -= 500;
                score -= assigments.length - generics.length
            }
            if((DESCRIPTOR_TYPE_UNMATCH & incompleteFlag) === DESCRIPTOR_TYPE_UNMATCH){
                score-= 1;
            }
            if( args.length > params.length ){
                score -= args.length - params.length;
            }else if( args.length < params.length){
                score -= params.length - args.length
            }
            return score;
        }
        const choose = (prev, desc, params, generics)=>{
            if(!prev){
                records.push(desc, params, generics, matchResult, incompleteFlag);
                return records;
            }
            let pScore = calcScore(prev[3], prev[1], prev[2], prev[4], prev[0])
            let cScore = calcScore(matchResult, params, generics, incompleteFlag, desc)
            let pResult = (FAILED_ASSING_GENERICS & prev[4]) !== FAILED_ASSING_GENERICS && prev[3];
            let cResult = (FAILED_ASSING_GENERICS & incompleteFlag) !== FAILED_ASSING_GENERICS && matchResult;
            if(pResult && cResult && pScore===cScore && desc.toString() === prev.toString()){
                if(desc.isDeclaratorFunction || desc.isDeclaratorVariable){
                    const cAnnots = desc.annotations.length + desc.imports.length;
                    const pAnnots = prev.annotations.length + prev.imports.length;
                    if(cAnnots>pAnnots){
                        return update(desc, params, generics);
                    }else if(cAnnots<pAnnots){
                        return prev;
                    }
                }
            }
            if(cResult){
                if(pResult && pScore > cScore)return prev;
                return update(desc, params, generics);
            }
            if(!pResult && cScore >= pScore){
                return update(desc, params, generics);
            }else{
                return prev
            }
        }
        const filter = (desc, prev, index, descriptors, extendsContext)=>{
            const isStaticDesc = desc.callableStatic || Utils.isStaticDescriptor(desc);
            if(isStatic){
                if( !isStaticDesc && !desc.isReadonly ){
                    if( !extendsContext || !extendsContext.callableStatic )return false;
                }
            }else if( isStaticDesc ){
                return false;
            }
            incompleteFlag = -1;
            if( isCall ){
                if( desc.isEnumProperty || desc.isMethodSetterDefinition || desc.isNamespaceDeclaration)return false;
                let params = emptyOnlyreadArray;
                let generics = emptyOnlyreadArray;
                if( desc.isMethodDefinition && !desc.isMethodGetterDefinition || desc.isDeclaratorFunction || desc.isTypeFunctionDefinition || isNew && desc.isNewDefinition || !isNew && desc.isCallDefinition){
                    generics = desc.genericity ? desc.genericity.elements : emptyOnlyreadArray;
                    params = desc.params || emptyOnlyreadArray;
                    if(isNew){
                        if(!(desc.isConstructor || desc.isNewDefinition || desc.isTypeFunctionDefinition))return false; 
                        if(generics===emptyOnlyreadArray && !desc.isNewDefinition){
                            generics = desc.module.getModuleDeclareGenerics(false,true);
                        }
                    }
                    if( checkMatchFun(params, generics, desc) ){
                        return true;
                    }
                }else if(desc.isPropertyDefinition || desc.isMethodGetterDefinition || desc.isDeclaratorVariable){
                    if(desc.isDeclaratorVariable && descriptors && descriptors.length===1){
                        return true;
                    }
                    let type = desc.type();
                    if( type ){
                        if(!isNew && desc.isDeclaratorVariable){
                            const origin = Utils.getOriginType(type)
                            if(Utils.isTypeModule(origin)){
                                let _result = origin.getDescriptor(`#${origin.id}`, filter, {isNew:false, isCall})
                                if(_result){
                                    target = _result;
                                    return true;
                                }
                            }
                        }
                        if( isNew ){
                            if( type.isClassGenericType && type.isClassType ){
                                return true;
                            }
                        }else if( type.isFunctionType ){
                            generics = type.generics;
                            params = type.params || emptyOnlyreadArray;
                            if( checkMatchFun(params, generics, desc) ){
                                return true
                            }
                        }
                    }
                }
                return choose(prev, desc, params, generics);
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
                if( desc.isMethodGetterDefinition || 
                    desc.isPropertyDefinition || 
                    desc.isEnumProperty || 
                    desc.isDeclaratorVariable || 
                    desc.isDeclaratorFunction || 
                    desc.isTypeFunctionDefinition){
                    return true;
                }
            }
            return prev || desc;
        }

        if(classModule.isUnionType){
            if(!isCall || isNew)return null;
            let resules = [];
            let matchedResules = [];
            let prev = null;
            classModule.elements.forEach((item)=>{
                const type = item.type();
                if(type.isFunctionType){
                    const generics = type.generics || emptyOnlyreadArray
                    const params = type.params || emptyOnlyreadArray;
                    if( checkMatchFun(params, generics, type) ){
                        matchedResules.push(type);
                    }else{
                        const value = choose(prev, type, params, generics);
                        const res = value === records ?  value[0] : value;
                        prev = value;
                        if( !resules.includes(res) ){
                            resules.push(res);
                        }
                    }
                } 
            });
            if( matchedResules.length>0 ){
                return matchedResules;
            }
            return resules;
        }

        const result = classModule.getDescriptor(property, filter, {isNew, isCall});
        return result === records ?  result[0] : target || result;
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
        if(object.isTypeofType ){
            object = object.origin;
        }
        if(object.isComputeType ){
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
            let matchResult = null;
            let isFullMatch = true;
            let anyType = null;
            let hasNull = false;
            for(let i=0;i<elems.length;i++){
                const item = elems[i];
                const objectType = item.type();
                if(!objectType || objectType.isAnyType || objectType.isNullableType || objectType.isUndefinedType){
                    if(objectType.isNullableType || objectType.isUndefinedType){
                        hasNull = true;
                    }
                    if(objectType.isAnyType){
                        anyType = objectType;
                    }
                    continue;
                }
                const result = this.getObjectDescriptor(objectType, property, isStatic, object, context);
                if( result ){
                    if(isCall){
                        if(!matchResult){
                            if( (result.isMethodDefinition && !result.isAccessor) || result.isFunctionExpression || result.isFunctionType){
                                matchResult = result
                            }else if( result.isPropertyDefinition || result.isMethodGetterDefinition || result.isTypeObjectPropertyDefinition || result.isProperty && result instanceof Stack ){
                                const type = result.type();
                                if( type.isFunctionType ){
                                    matchResult = result;
                                }
                            }
                        }
                    }else if(!matchResult){
                        if( isTypeDefinition(result) ){
                            matchResult = result;
                            properties.length = 0;
                        }else{
                            properties.push(result);
                        }
                    }
                }else{
                    isFullMatch = false;
                }
            }

            const references = this.compiler.options.checker.references;
            if(!isFullMatch && references.exactly){
                (this.object||this).warn(1188, property)
            }

            if(hasNull && this.isMemberExpression && !this.optional && references.noNullable){
                let state = null;
                let scope = this.scope;
                if(scope && scope.allowInsertionPredicate()){
                    state = scope.getValidateState(this.object.description());
                }
                if(!state || !state.value){
                    let hasCheck = false;
                    let pp = this.getParentStack(p=>!(p.isMemberExpression || p.isCallExpression || p.isNewExpression || p.isParenthesizedExpression));
                    if(pp && pp.isLogicalExpression && pp.isAndOperator){
                        let refs = null;
                        const items = this.getConditions(pp);
                        const current = items.find( item=>{
                            refs = item;
                            if(item.isCallExpression || item.isNewExpression){
                                refs = item.callee;
                            }
                            if(refs === this)return true;
                            return refs.isMemberExpression ? refs.object === this.object : false;
                        });
                        if(current && refs){
                            refs = refs.isMemberExpression ? refs.object : refs;
                            const refsDesc = refs.description();
                            const leftItem = items.find( item=>{
                                if(item===current)return false;
                                return item.description() === refsDesc
                            });
                            if(leftItem && leftItem.parentStack.isLogicalExpression){
                                if(leftItem.parentStack === current.parentStack){
                                    hasCheck = true;
                                }else{
                                    hasCheck = leftItem.parentStack.isAndOperator;
                                }
                            }
                        }
                    }
                    if(!hasCheck){
                        this.object.warn(1190, property);
                    }
                }
            }

            if( properties.length > 0 ){
                if( properties.length===1 ){
                    matchResult = properties[0];
                }else{
                    const mergeType = new MergeType();
                    properties.forEach( item=>{
                        mergeType.add( item )
                    });
                    matchResult = mergeType.type();
                }
            }
            return matchResult || anyType;
        }else if( this.isLiteralObject(object) ){
            dynamicAttribute = true;
            let desc = object.target && (object.target.isObjectExpression || object.target.isTypeObjectDefinition) ? object.target.attribute(property) : object.attribute(property);
            if(desc){
                return desc;
            }
        }

        const origin = Utils.getOriginType(object);
        result = this.getMatchDescriptor(property, origin, isStatic);
        if( !result ){
            let literalType = typeof property === 'number' ? 'number' : 'string';
            if(object.isLiteralArrayType || object.isTupleType){
                if(literalType==='string'){
                    literalType = null;
                    if(!isNaN(parseInt(property))){
                        literalType = 'number';
                    }
                }else{
                    literalType = 'number'
                }
            }
            if(literalType){
                result = this.getObjectDynamicDescriptor( dynamicAttribute ? object : origin, Namespace.globals.get(literalType), ctx);
            }
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
            result = this.getObjectDynamicDescriptor(
                dynamicAttribute ? object : origin,
                Namespace.globals.get(object.isLiteralArrayType || object.isTupleType ? 'number' : 'string'),
                ctx
            );
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

    getObjectDynamicDescriptor(object, propertyType, ctx=null){
        if( this.isLiteralObject(object) || Utils.isTypeModule(object) ){
            if(object.isGenericType){
                if(Context.is(ctx)){
                    object = ctx.inferValue(object) || object;
                }else if(object.hasConstraint){
                    object = object.inherit.type();
                }
            }
            if(propertyType && Type.is(propertyType)){
                return object.dynamicAttribute(propertyType, ctx);
            }
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
                stack.isTypeUniqueDefinition || 
                stack.isTypePredicateDefinition || 
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
        if(!desc)return;
        if(desc.isStack && desc.module === this.module ){
            if(desc.isMethodDefinition || desc.isPropertyDefinition || desc.isFunctionExpression){
                desc.parser();
            }
        }
    }

    isModuleStack(stack){
        if(!stack || !stack.isStack)return false;
        return stack.isDeclaratorDeclaration || 
                stack.isClassDeclaration || 
                stack.isInterfaceDeclaration || 
                stack.isStructTableDeclaration || 
                stack.isEnumDeclaration && !stack.isExpressionDeclare;
    }

    setRefBeUsed( description ){
        let desc = description || this.description();
        if(!desc)return;
        let target = this;
        if( target.isMemberExpression ){
            target = target.property;
        }
        if( desc!==this && this.is(desc) ){
            desc.addUseRef( target );
        }else if(desc && Utils.isTypeModule(desc)){
            desc.getStacks().forEach( stack=>{
                if(stack !== target ){
                    stack.addUseRef( target );
                }
            });
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
            if(!(stack.parentStack && ( stack.parentStack.isProgram || stack.parentStack.isPackageDeclaration ))){
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
    deprecated(code, ...args){
        this.compilation.deprecated(this.node,code,...args);
    }
    unnecessary(code, ...args){
        this.compilation.unnecessary(this.node,code,...args);
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

    getConditions(stack){
        if(stack.isLogicalExpression){
            return [this.getConditions(stack.left), this.getConditions(stack.right)].flat();
        }else if(stack.isParenthesizedExpression){
            return this.getConditions(stack.expression);
        }
        return [stack];
    }

    parseConditionState(stack){
        if(!stack)return;
        const pp = stack.parentStack;
        const scope = pp.isWhileStatement ? pp.body.scope : pp.consequent.scope;
        if(!scope.allowInsertionPredicate())return;
        this.getConditions(stack).forEach(stack=>{
            let value = true;
            if(stack.isUnaryExpression){
                if(stack.isLogicalFlag){
                    value = stack.isLogicalTrueFlag;
                }
                stack = stack.argument;
                if(stack.isParenthesizedExpression){
                    stack = stack.expression
                }
            }
            if(!(stack.isIdentifier || stack.isMemberExpression))return;
            stack.parser();
            const desc = stack.description();
            if(desc){
                const old = scope.getValidateState(desc, true);
                if(old && old.value !== value){
                    stack.warn(1191);
                    old.expr.warn(1191);
                }else{
                    scope.setValidateState(desc, this, value, stack)
                }
            }
            const type = stack.type();
            if(type && type.isPredicateType){
                let dataset = pp.scope.define('#predicate-type#');
                if(dataset){
                    const value = dataset.get(desc);
                    if(value){
                        const [descriptor, assignType, rDesc, origin] = value;
                        scope.setPredicate(descriptor, Predicate.create(assignType, rDesc, origin));
                    }
                }
            }
        });
    }

    addImportSpecifierDependency(importSpecifier){
        if(!importSpecifier)return;
        if(importSpecifier.parentStack && importSpecifier.parentStack.isImportDeclaration){
            let source = importSpecifier.parentStack.source.value();
            let name = importSpecifier.value();
            let owner = this.isImportDeclaration ? this.additional : this;
            let context = owner.module || this.compilation;
            if(importSpecifier.isImportDefaultSpecifier){
                context.addRequire(name, name, source, source, false, importSpecifier)
            }else if(importSpecifier.isImportNamespaceSpecifier){
                context.addRequire('*', name, source, source, false, importSpecifier)
            }else if(importSpecifier.isImportSpecifier){
                context.addRequire(name, importSpecifier.imported.value(), source, source, true, importSpecifier)
            }
        }else if(AutoImporter.is(importSpecifier)){
            let context = this.module || this.compilation;
            let name = importSpecifier.local;
            let source = importSpecifier.source;
            let imported = importSpecifier.imported;
            let extract = importSpecifier.extract;
            context.addRequire(imported, name, source, source, extract);
        }
    }
}

module.exports = Stack;
