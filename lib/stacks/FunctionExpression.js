const Utils = require("../core/Utils");
const Declarator = require("./Declarator");
const FunctionScope = require("../scope/FunctionScope");
const Expression = require("./Expression");
const FunctionType = require("../types/FunctionType");
const MergeType = require("../core/MergeType");
const InstanceofType = require("../types/InstanceofType");
const keySymbol = Symbol("key");
const Namespace = require("../core/Namespace");
class FunctionExpression extends Expression{
    constructor(compilation,node,scope,parentNode,parentStack){
        scope = new FunctionScope(scope); 
        super(compilation,node,scope,parentNode,parentStack);
        let isDeclarator = node.type ==='DeclaratorFunction';
        if(!isDeclarator && parentStack && parentStack.isMethodDefinition ){
            scope.isMethod=true;
            if( parentStack.isConstructor ){
                scope.isConstructor = true;
                this.isConstructor = true;
            }
            isDeclarator = !!parentStack.parentStack.isDeclaratorDeclaration;
        }
        this.isFunctionExpression=true;
        this.genericity = this.createTokenStack(compilation,node.genericity,scope,node,this);
        this._returnType= this.createTokenStack(compilation,node.returnType,scope,node,this);
        this._recursionType = null;
        this.hasReturnType = !!node.returnType;
        this.thisArgumentContext = null;
        const first = node.params[0];
        let assignment = null;
        let hasRest = null;
        if(first && first.type =="Identifier" && first.name==='this'){
            this.thisArgumentContext = new Declarator(compilation,node.params.shift(),scope,node,this)
        }
        this._hasRecursionReference = false;
        this._recursionCallStacks = null;
        this.params = node.params.map( item=>{
            let annotations = item.annotations;
            if(annotations && annotations.length>0){
                annotations = annotations.map( annotation=>{
                    return this.createTokenStack(compilation,annotation,scope,item,this);
                });
            }
            let stack = null;
            if( item.type =="Identifier" ){
                stack = new Declarator(compilation,item,scope,node,this);
                if( assignment && !stack.question ){
                    assignment.error(1050,assignment.value()); 
                }
                scope.define(stack.value(), stack);
                // if(!isDeclarator){
                //     scope.define(stack.value(), stack);
                // }
            }else{
                stack = this.createTokenStack(compilation,item,scope,node,this);
                if( stack.isRestElement ){
                    hasRest = stack;
                }
                assignment = stack;
            }
            if(annotations && annotations.length>0){
                stack.annotations = annotations;
                annotations.forEach( annotation=>{
                    annotation.additional = stack;
                });
            }
            return stack;
        });

        if( hasRest && this.params[ this.params.length-1 ] !== hasRest ){
            hasRest.error(1051,hasRest.value());
        }

        this.awaitCount = 0;
        this.async = scope.async =!!node.async;
        if( this.async ){
            scope.asyncParentScopeOf = scope;
        }
        if( !parentStack.isMethod ){
            this.callable = true;
        }
        this.body  = this.createTokenStack(compilation,node.body,scope,node,this);
        this[keySymbol]={};
        if(this.body){
            this.compilation.hookAsync('compilation.create.after',async ()=>{
                this.scope.define("arguments", Namespace.globals.get("IArguments"));
                if(!(this.parentStack.isMethodDefinition || this.isArrowFunctionExpression)){
                    this.scope.define("this",Namespace.globals.get('Record'));
                }
            });
        }
    }
    freeze(){
        super.freeze();
        super.freeze(this.params);
        this.genericity && this.genericity.freeze();
        this._returnType && this._returnType.freeze();
        this.body && this.body.freeze();
        this.params.forEach(stack=>stack.freeze());
    }

    definition(ctx){

        let complete  = false;
        if( !ctx || (ctx.stack && (ctx.stack === this.key || ctx.stack === this || ctx.stack.isMemberExpression))){
            complete = true;

            ctx = this.getContext();
            if(!ctx.inCallChain() ){
                ctx = {}
            }
           
            if(ctx && ctx.stack && (ctx.stack.isCallExpression || ctx.stack.isNewExpression)){
                
            }else{
                //ctx = {};
            }
        }

        const token = this.parentStack.isProperty || this.parentStack.isMethodDefinition ? this.parentStack.key : this.key;
        let type = this.getReturnedType();
        if(Utils.isContext(ctx) && ctx.stack && ctx.stack.isCallExpression){
            type = ctx.apply(type);
        }

        const _thisCtx = this.thisArgumentContext;
        const _params = _thisCtx ? [_thisCtx, ...this.params] : this.params;
        const params  = _params.map( item=>{
            if( item.isObjectPattern ){
                const properties = item.properties.map( property=>{
                    const name = property.key.value();
                    const acceptType = property.type().toString(ctx)
                    const init = property.init;
                    if( init && init.isAssignmentPattern ){
                        return `${init.left.value()}:${acceptType} = ${init.right.raw()}`;
                    }
                    return `${name}:${acceptType}`;
                });
                return `{${properties.join(',')}}`;
            }else if( item.isArrayPattern ){
                const properties = item.elements.map( property=>{
                    const acceptType =property.type().toString(ctx)
                    if( property.isAssignmentPattern ){
                        return `${property.left.value()}:${acceptType} = ${property.right.raw()}`;
                    }
                    const name = property.value();
                    return `${name}:${acceptType.toString(ctx)}`;
                });
                return `[${properties.join(',')}]`;
            }else{
                const name = item.value();
                const type = item.type().toString(ctx);
                const rest = item.isRestElement ? '...' : '';
                const question = item.question ? '?' : '';
                if( item.isAssignmentPattern && item.right ){
                    const initial = item.right.value();
                    return `${rest}${name}${question}: ${type}=${initial}`;
                }
                return `${rest}${name}${question}: ${type}`;
            }
        });

        const generics = (this.genericity ? this.genericity.elements : []).map( item=>{
            return item.type().toString(ctx,{complete});
        });

        const strGenerics = generics.length > 0 ? `<${generics.join(", ")}>` : '';
        const returnType = type ? type.toString(ctx, {chain:['function']}) : 'void';
        let kind = 'function';
        let key = token ? token.value() : 'anonymous';
        let loc = null;
        if(this.isNewDefinition){
            key = this.module.getName();
            kind = 'new';
            loc = this.getLocation();
        }else if(this.isCallDefinition || this.parentStack.isMethodDefinition){
            kind = 'method';
        }

        if(this.isArrowFunctionExpression || this.isCallDefinition){
            return {
                comments:this.comments,
                kind,
                expre:`${kind} ${strGenerics}(${params.join(", ")})=>${returnType}`,
                location:this.getLocation(),
                file:this.compilation.file,
            };
        }
        
        return {
            comments:this.comments,
            kind,
            expre:`${kind} ${key}${strGenerics}(${params.join(", ")}): ${returnType}`,
            location:loc || (token ? token.getLocation() : null),
            file:this.compilation.file,
        };
    }

    signature(){
        const def = this.definition()
        const _params = this.params;
        const comments = this.parseComments();
        const params  = _params.map( item=>{
            if( item.isObjectPattern ){
                return {
                    label:"ObjectPattern"
                }
            }else if(item.isArrayPattern){
                return {
                    label:"ArrayPattern"
                }
            }else{
                const name = item.value();
                const meta = comments && comments.params.find(param=>param.label===name);
                return {
                    label:name,
                    comment:meta && meta.comment ? meta.comment : item.comments.join("\n")
                }
            }
        })
        def.params = params;
        return def;
    }

    reference( called ){
        if( called ){
            const stack = this.scope.returnItems[ this.scope.returnItems.length-1 ];
            return stack ? stack.reference() : null;
        }
        return this;
    }

    referenceItems( called ){
        if( called ){
            let items = [];
            this.scope.returnItems.forEach( item=>{
                items = items.concat( item.referenceItems(called) );
            })
            return items;
        }else{
            return [this];
        }
    }

    description(){
        return this;
    }

    getRelateRuturnType(stack, argument, propertyStack=[]){
        if( stack.isObjectExpression ){
            return this.getRelateRuturnType( stack.parentStack, stack, propertyStack.concat(argument));
        }else if( stack.isProperty ){
            return this.getRelateRuturnType( stack.parentStack, stack, propertyStack);
        }else if( stack.isArrayExpression ){
            return this.getRelateRuturnType( stack.parentStack, stack, propertyStack.concat(argument));
        }

        if(stack.isVariableDeclarator && (stack.init === this||!stack._acceptType)){
            return null;
        }

        const fetchObjectType=(object, property)=>{
            if(property.isProperty){ 
                object = stack.getObjectDescriptorForAuxiliary(object, property.value());
                if(object){
                    return object.type();
                }
            }else if(object.isTupleType && property.parentStack.isArrayExpression){
                const index = property.parentStack.elements.indexOf(property);
                const type = object.prefix || object.rest ? object.elements[0] : object.elements[index];
                if(type){
                    return type.type();
                }
            }
            return null;
        }

        const fetchType=(declareParam)=>{
            if(!declareParam)return null;
            let type = declareParam.type();
            if(type && type.isTupleType && type.rest){
                type = type.elements[0]?.type();
            }
            while(type && type.isAliasType){
                type = type.inherit.type();
            }
            if(type && (argument.isArrayExpression || argument.isObjectExpression)){
                let desc = type.type();
                while(desc && propertyStack.length>0){
                    desc = fetchObjectType(desc, propertyStack.pop())
                }
                return desc; 
            }
            return declareParam;
        }

        if(stack.isAssignmentExpression || stack.isVariableDeclarator){
            let result = fetchType(stack.isVariableDeclarator ? stack.type() : stack.left.type());
            if(result){
                let type = result.type();
                if(type && type.isFunctionType && type.target && type.target !== this){
                    type = (type.target.isFunctionExpression || type.target.isTypeFunctionDefinition) ? type.target.returnType : null;
                    if(type){
                        return type.type();
                    }
                }
            }
            return null;
        }
    
        if( !(stack.isCallExpression || stack.isNewExpression) ){
            return null
        }

        let index = stack.arguments.indexOf(argument);
        let funType = stack.isCallExpression ? stack.descriptor() : stack.description();
        let declareParams = stack.getFunDeclareParams(funType);
        if(funType && declareParams){
            const declare = fetchType(declareParams[index]);
            if( declare ){
                const result = Utils.extractFunTypeFromType(declare.type());
                if( result ){
                    const [funType, ctx] = result;
                    if( funType && funType.isFunctionType && funType.target && funType.target !== this){
                        let returnType = funType.returnType;
                        if(returnType){
                            returnType = returnType.type();
                            if( ctx ){
                                returnType = ctx.fetch(returnType, true);
                            }
                            if( !returnType.isVoidType ){
                                return returnType;
                            }
                        }
                    }
                }
            }
        }
        return null;
    }

    get hasRecursionReference(){
        return !!(this._hasRecursionReference || this.recursionCallStacks)
    }

    get recursionCallStacks(){
        return this._recursionCallStacks;
    }

    addRecursionCallStacks(stack){
        const stacks = this._recursionCallStacks || (this._recursionCallStacks = []);
        stacks.push(stack);
    }

    get rawReturnType(){
        return this._returnType || null;
    }

    get returnType(){
        return this.getAttribute('FunctionExpression.returnType',()=>{

            let returnResult = null;
            if( this._returnType  ){
                returnResult = this._returnType.type();
            }else{
                if( this.parentStack.isMethodDefinition ){
                    const method = this.parentStack;
                    if(!method.isMethodSetterDefinition && !method.isConstructor){
                        const key = method.value();
                        const module = method.module;
                        const result = this.findMethodInheritReturnType(module, key, Utils.getModifierValue(method), method.kind, !!method.static)
                        if(result){
                            returnResult = result.type();
                        }
                    }
                }
                /*
                else if(this.parentStack.isAssignmentExpression){
                    const type = this.parentStack.left.type();
                    if( type && type.isFunctionType ){
                        const result = type.target && (type.target.isFunctionExpression || type.target.isTypeFunctionDefinition) ? type.target.returnType : null;
                        if( result ){
                            returnResult = result.type();
                        }
                    }
                }else if(this.parentStack.isCallExpression || this.parentStack.isNewExpression){
                    const index = this.parentStack.arguments.indexOf(this);
                    let desc = this.parentStack.description();
                    if( desc && (desc.isFunctionType || desc.isFunctionExpression || desc.isMethodDefinition) ){
                        const declares = desc.isFunctionType && desc.target ? desc.target.params : desc.params;
                        const declare = declares[index];
                        if( declare ){
                            const result = Utils.extractFunTypeFromType(declare.type());
                            if( result ){
                                const [funType, ctx] = result;
                                if( funType && funType.isFunctionType ){
                                    let returnType = funType.returnType;
                                    if(returnType){
                                        returnType = returnType.type();
                                        if( ctx ){
                                            returnType = ctx.fetch(returnType, true);
                                        }
                                        if( !returnType.isVoidType ){
                                            returnResult = returnType;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }*/
                 else{
                    returnResult = this.getRelateRuturnType(this.parentStack, this)
                }
            }
    
            return returnResult;

        });
    }

    inferReturnType(){
        if( this.isArrowFunctionExpression && this.scope.isExpression ){
            return this.body.type();
        }
        return this.getAttribute('inferReturnType',()=>{
            this._inferReturnTyping = true;
            const returnItems = this.scope.returnItems;
            if( !returnItems || !returnItems.length ){
                return Namespace.globals.get("void");
            }

            //const root = this.getParentStack(parent=>parent.isFunctionDeclaration || parent.isVariableDeclarator || parent.isMethodDefinition)
            const mergeType = new MergeType();
            mergeType.keepOriginRefs = false;
            mergeType.keepLiteralArrayType = true;
            let breakContext = null;
            let hasVoid = null;
            let emptyArrayType = null;
            let hasTupleType = false;

            for(let item of returnItems ){

                let argument = item.argument;
                if(argument){
                    // if(argument.isCallExpression){
                    //     argument = argument.callee;
                    // }
                    // let object = argument;
                    // if(object.isMemberExpression){
                    //     object = object.object;
                    // }
                    // if(object.isCallExpression){
                    //     object = object.callee;
                    // }
                    // if(object.isIdentifier){
                    //     const def = object.description()
                    //     if(def === root){
                    //         continue;
                    //     }
                    // }
                    // if(argument.descriptor() === root){
                    //     continue;
                    // }

                    if(argument.isIdentifier){
                        const def = argument.description()
                        if(def && def.isVariableDeclarator){
                            const desc = def.init.descriptor();
                            if(desc === this || this.parentStack === desc){
                                continue;
                            }
                        }
                    }else{
                        const def = argument.descriptor();
                        if(def===this || def===this.parentStack){
                            continue;
                        }
                    }

                    //如果有递归调用，导致递归调之后的条件块还未被解析，所以需要在推理前先调用解析，才能推理到正确类型 
                    if(this._hasRecursionReference){
                        const block = argument.getParentStack(parent=>parent.isIfStatement || parent===this)
                        if(block && block.isIfStatement){
                            block.parser()
                        }
                    }
                
                }else{
                    continue;
                }

                let type = item.type();
                if(!type || type.isRecursionType)continue;
                let ips = item.parentStack;
                if(type.isLiteralArrayType){
                    hasVoid = false;
                    if(type.elements.length===0){
                        emptyArrayType = type;
                        continue;
                    }
                }else if(type.isTupleType){
                    hasTupleType = true;
                }

                if( ips.isBlockStatement && ips.parentStack.isIfStatement ){
                    hasVoid = true
                    if(ips.parentStack.alternate && ips.parentStack.alternate.hasThrowStatement){
                        hasVoid = false;
                    }
                    if( ips.parentStack.alternate === ips ){
                        if(ips.parentStack.consequent.hasThrowStatement){
                            hasVoid = false;
                        }
                        let pp = ips.parentStack.parentStack;
                        if(pp && pp.parentStack === this ){
                            breakContext = pp;
                            hasVoid = false
                        }else if(pp && pp.parentStack.isIfStatement){
                            hasVoid = false
                        }
                    }
                    mergeType.add(type);
                }else if( ips.isSwitchCase ){
                    mergeType.add(type);
                }
                else{
                    if( breakContext === ips && ips.parentStack === this ){
                        break;
                    }else{
                        if(ips.isBlockStatement && ips.parentStack === this || ips=== this){
                            hasVoid = false
                        }else if(ips.isBlockStatement && ips.hasThrowStatement){
                            hasVoid = false
                        }
                        mergeType.add(type);
                    }
                }
            }
            if(emptyArrayType && !hasTupleType){
                mergeType.add(emptyArrayType)
            }else if(hasVoid){
                mergeType.add( Namespace.globals.get("void") );
            }
            this._inferReturnTyping = false;
            const type = mergeType.type();   
            if(this._recursionType){
                this._recursionType.result = type
            }
            return type;
        });
    }

    normalization( type ){
        if( type && type.isUnionType ){
            if(type.elements.some( type=>{
                type = type.type();
                if(type.isComputeType)return false;
                return type && type.isAnyType;
            })){
                return Namespace.globals.get("any");
            }
        }
        return type;
    }

    getReturnedType(caller){
        let returnType = this.returnType;;
        if(!returnType && caller && caller.parentStack.isVariableDeclarator){
            const context = caller.parentStack.getParentStack(parent=>parent.isFunctionExpression)
            if(context === this){
                this._hasRecursionReference = true;
            }
        }
        return this.getAttribute('getReturnedType', ()=>{
            let type = returnType;
            let value = null;
            if( type ){
                value = this.normalization( type.type() );
            }else{
                value = this.inferReturnType();
            }
            if(this.async){
                const origin = Utils.getOriginType(value);
                const promiseType = Namespace.globals.get("Promise");
                if(!promiseType.is(origin)){
                    value = new InstanceofType(promiseType, null, [value]);
                }
            }
            return value;
        });
    }

    type(){
        return this.getFunType();
    }

    getFunType(){
        return this.getAttribute('getFunType',()=>{
            return new FunctionType(Namespace.globals.get("Function"), this)
        });
    }

    parser(){
        if(super.parser()===false)return false;
        if(this.genericity){
            this.genericity.parser();
        }

        const _thisArg = this.thisArgumentContext;
        if(_thisArg){
            _thisArg.parser();
        }

        this.params.forEach((item)=>{
            item.parser();
            if(item.annotations && item.annotations.length>0){
                item.annotations.forEach( annotation=>{
                    annotation.parser();
                });
            }
        });

        if(this._returnType){
            this._returnType.parser();
            this._returnType.setRefBeUsed();
        }

        if( this.isNewDefinition || this.isCallDefinition){
            return;
        }

        if(this.body){
            this.body.parser();
        }
        
        if( this.parentStack && this.parentStack.parentStack && this.parentStack.parentStack.isUseExtendStatement ){
            return;
        }

        if( !this.isDeclaratorFunction ){
            const isInterface = this.module && (this.module.isDeclaratorModule || this.module.isInterface);
            if( this.isConstructor && this.module && !isInterface && !this.getMatchDescriptor('#'+this.module.id, this.module)){
                if( this.scope.returnItems.length > 0 ){
                    const last = this.scope.returnItems[ this.scope.returnItems.length-1 ]
                    last.error(1052);
                }
                if( this.module.inherit && this.scope.firstSuperIndex != 1){
                    (this.body.childrenStack[0]||this.key).error(1053);
                }
            }else if( !isInterface && this.body){
                let acceptType = this.returnType;
                if( acceptType ){
                    acceptType = acceptType.type();
                    const hasVoidType = (type, prev=null)=>{
                        if(!type || type===prev)return false;
                        if(type.isGenericType){
                            if(type.assignType){
                                return hasVoidType(type.assignType.type(), type)
                            }else if(type.hasConstraint){
                                return hasVoidType(type.inherit.type(), type)
                            }
                            return true;
                        }
                        if(type.isVoidType || type.isAnyType)return true;
                        return type.isUnionType ? type.elements.some( el=>hasVoidType(el.type(), type) ) : false;
                    }
                    if( !hasVoidType(acceptType) ){
                        if( this.async ){
                            const promiseType = Namespace.globals.get("Promise");
                            if( promiseType && !promiseType.is( acceptType.type() ) ){
                                (this._returnType || this).error(1055,promiseType.toString());
                            }
                        }else if( !this.scope.returnItems.length ){
                            if( !(this.scope.isArrow && this.scope.isExpression) ){
                                const target = this.parentStack.isMethodDefinition ? this.parentStack.key : this.key;
                                const body = this.body;
                                const has = (body && body.isBlockStatement && body.body).some( item=>{
                                    return !!(item && item.isThrowStatement);
                                });
                                if( !has ){
                                    (target || this).error(1133);
                                }
                            } 
                        }
                    }
                }
            }
        }
    }
}

module.exports = FunctionExpression;