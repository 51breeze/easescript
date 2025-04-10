const Utils = require("../core/Utils");
const Expression = require("./Expression");
const Stack = require("../core/Stack");
const Namespace = require("../core/Namespace");
const MergeType = require("../core/MergeType");
const Predicate = require("../core/Predicate");
const UnionType = require("../types/UnionType");
class CallExpression extends Expression{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isCallExpression= true;
        this.callee = this.createTokenStack( compilation, node.callee, scope, node, this );
        this.arguments = node.arguments.map( item=>this.createTokenStack( compilation,item,scope,node,this) );
        this.genericity=null;
        if( node.genericity ){
            this.genericity = node.genericity.map(item=>this.createTokenStack(compilation,item,scope,node,this));
        }
        this.optional = !!node.optional;
    }

    freeze(){
        super.freeze(this);
        this.callee.freeze();
        super.freeze(this.genericity);
        (this.genericity || []).forEach( stack=>stack.freeze() );
    }

    definition(ctx){
        const identifier = this.callee.value();
        if(this.parentStack.isWhenStatement){
            const type = 'boolean';
            const params  =  this.arguments.map( (item)=>item.value() );
            return {
                text:`(method) ${identifier}(${params.join(",")}):${type}`,
            };
        }
        let description= this.descriptor();
        if(!description){
            description = this.description();
        }
        if(!description)return null;
        if(description.isType && description.isAnyType){
            return null;
        }
        const context = this.getContext();
        if(ctx){
            context.setHoverStack(ctx.hoverStack)
        }
        return description.definition(context);
    }

    hover(ctx){
        const identifier = this.callee.value();
        if(this.parentStack.isWhenStatement){
            const type = 'boolean';
            const params  =  this.arguments.map( (item)=>item.value() );
            return {
                text:`(method) ${identifier}(${params.join(",")}):${type}`,
            };
        }
        let description= this.description();
        if( !description )return null;
        if( description && (description.isType && description.isAnyType) ){
            return {
                text:`any`,
            };
        }
        const context = this.getContext();
        if(ctx){
            context.setHoverStack(ctx.hoverStack)
        }
        return description.hover(context);
    }

    reference(){
        let description = this.description();
        if( description ){
            if( description instanceof Stack ){
                return description.reference(true);
            }else if( description.isFunctionType ){
                return description.type();
            }
        }
        return null;
    }

    referenceItems(){
        let description = this.description();
        if( description ){
            if( description instanceof Stack ){
                return description.referenceItems(true);
            }else if( description.isFunctionType ){
                return [].concat( description.type() );
            }
        }
        return [];
    }

    description(){
        return this.callee.description();
    }

    descriptor(){
        return this.getAttribute('CallExpression.descriptor', ()=>{
            if(this.callee.isSuperExpression){
                return this.getMatchDescriptor('constructor', this.callee.type()) || Namespace.globals.get('any');
            }
            let desc = this.callee.descriptor();
            if(!desc)return null;
            if(desc.isMethodDefinition && !desc.isAccessor || desc.isFunctionExpression || desc.isDeclaratorFunction || desc.isFunctionType || desc.isTypeFunctionDefinition){
                return desc;
            }
            let ctx = null;
            const Fun = Namespace.globals.get('Function');
            const fetch = (type, exclude=null)=>{
                if(type && type.isGenericType){
                    ctx = ctx || this.callee.getContext()
                    type = ctx.fetch(type, true)
                }

                if(type === exclude)return null;
                if(!type || type.isNullableType || type.isNeverType || type.isVoidType || type.isUndefinedType)return null;
                if(type.isComputeType){
                    type = type.getResult();
                }
                if(type.isLiteralObjectType){
                    type = this.getMatchDescriptor(`#call#`, type);
                }
                if(!type)return null;
                if(type === Fun || type.isFunctionType || type.isAnyType || type.isTypeFunctionDefinition)return type;
                if(type.isTypeofType){
                    return fetch(type.origin.type(), type);
                }else if(type.isIntersectionType){
                    return fetch(type.left.type(), type) || fetch(type.right.type(), type);
                }else if(type.isUnionType){
                    const els = type.elements;
                    for(let index=0; index<els.length;index++){
                        let res = fetch(els[index].type(), type)
                        if(res)return res;
                    }
                    return null;
                }else if(type.isAliasType){
                    if(Utils.isGlobalShortenType(type))return null;
                    return fetch(type.inherit.type(), type);
                }else if(type.isClassGenericType){
                   // this.getContext().make(type);
                }
                if(Utils.isTypeModule(type)){
                    return this.getMatchDescriptor(`#${type.id}`, type)
                }else{
                    return fetch(Utils.getOriginType(type), type);
                }
            }
            return fetch(desc.type());
        })
    }

    value(){
        return this.callee.value();
    }

    getFunDeclareParams( description=null ){
        if(!description){
            description = this.descriptor()
        }
        if(!description)return [];
        const declareParams = description.isFunctionType && description.target ? description.target.params : description.params;
        return declareParams || [];
    }

    getDeclareGenerics(description){
        const genericity = description.isFunctionType && description.target ? description.target.genericity : description.genericity;
        return [genericity ? genericity.elements : [], null];
    }

    getCalleeDeclareGenerics(){
        const description = this.descriptor()
        const genericity = description.isFunctionType && description.target ? description.target.genericity : description.genericity;
        if(genericity){
            return genericity.elements.map(item=>item.type())
        }
        return null;
    }

    getAssigmentGenerics(){
        return this.genericity || null;
    }

    getRawType(){
        const type = this.type();
        return this.getAttribute('CallExpression.getRawType') || type;
    }

    getReturnType(){
        return this.getAttribute('CallExpression.getReturnType',()=>{
            let description = this.descriptor();
            if(!description){
                return Namespace.globals.get('any');
            }
            let type = null;
            if(description.isMethodDefinition || description.isFunctionExpression){
                const result = description.getReturnedType();
                if(result){
                    type = result.type()
                }
            }else{
                let result = description.type();
                let anyType = null;
                if(result.isUnionType){
                    const elements = result.elements.map((item)=>{
                        let type = item.type();
                        if(type.isFunctionType){
                            type = type.getInferReturnType();
                            if(type){
                                if(type.isAnyType)anyType = type;
                                if(type.isVoidType || type.isUndefinedType)return;
                                if(type.isUnionType)return type.elements.map( item=>item.type() )
                            }
                            return type;
                        }
                    }).filter(Boolean).flat();
                    if(anyType){
                        type = result = anyType;
                    }else{
                        if(elements.length>1){
                            const merge = new MergeType();
                            merge.target = result.target;
                            elements.forEach( type=>merge.add(type) );
                            type = result = merge.type();
                        }else{
                            type = result = elements[0];
                        }
                    }
                }
                if( result.isInstanceofType && result.isThisType ){
                    const refs = this.callee;
                    if( refs && refs.isMemberExpression ){
                        result = refs.object.type();
                    }else{
                        result = refs.type();
                    }
                }

                if(result && result.isFunctionType){
                    result = result.returnType;
                    if(result){
                        type = result.type();
                    }
                }
            }
            if(!type){
                return Namespace.globals.get('any');
            }
            if( type.isInstanceofType && type.isThisType && this.callee.isMemberExpression){
                const _type = this.callee.object.type();
                if(_type.isUnionType){
                    const els = _type.elements.filter( el=>{
                        const t = el.type();
                        if(t.isNullableType || t.isUndefinedType || t.isNeverType || t.isVoidType || t.isUnknownType)return false;
                        return true;
                    });
                    if(els.length===1){
                        return els[0].type();
                    }
                }
                return _type;
            }
            return type;
        })
    }

    type(){
        return this.getAttribute('CallExpression.type',()=>{
            let type = this.getReturnType();
            let final = this.getContextOfInference().apply(type);
            if(final){
                return final;
            }
            return Namespace.globals.get('any');
        });
    }

    parserArguments(){
        this.arguments.forEach((item)=>{
            //if(item.isFunctionExpression /*|| item.isObjectExpression || item.isArrayExpression*/){
                item.parser();
                item.setRefBeUsed();
            //}
        });
    }

    isCallableDesc(desc){
        if( !(desc.callable || desc.isAnyType || desc.isFunctionType || this.callee.isSuperExpression) ){   
            if( desc.isUnionType && Array.isArray(desc.elements) ){
                return desc.elements.some(item=>this.isCallableDesc(item.type()));
            }
            return false
        }
        return true;
    }

    presetPredicateType(declareParams, args){
        if(!declareParams || !declareParams.length)return;
        let type = this.getReturnType()
        if(!type || !type.isPredicateType)return;
        let pp = this.parentStack;
        if(pp.isParenthesizedExpression)pp = pp.parentStack;
        if(pp.isLogicalExpression)pp = pp.parentStack;
        if(pp.isUnaryExpression && pp.isLogicalFlag && pp.isLogicalTrueFlag){
            pp = pp.parentStack;
        }

        let index = declareParams.indexOf(type.argument.description());
        let argument = args[index];
        if(!argument)return;
        let lDesc = argument.description();
        
        if(pp.isIfStatement || pp.isConditionalExpression){
            const scope = pp.consequent.scope;
            const condition = pp.isIfStatement ? pp.condition : pp.test;
            if(scope && scope.allowInsertionPredicate()){
                let assignType = type.inferType();
                let rDesc = type.value.description();
                let existed = scope.getPredicate(lDesc, true);
                let cacheId = this.getCacheId();
                if(assignType.isComputeType){
                    assignType = assignType.getComputeType(null, this.getContext())
                }
                if(existed && existed.cacheId ===cacheId){
                    if(condition.isLogicalExpression){
                        if(condition.operator.charCodeAt(0) === 38){
                            condition.warn(1187)
                        }else{
                            if( existed.type.isUnionType ){
                                existed.type.elements.push(assignType)
                            }else{
                                scope.setPredicate(lDesc, Predicate.create(
                                    new UnionType([existed.type, assignType]),
                                    rDesc,
                                    this,
                                    cacheId
                                ));
                            }
                        }
                    }else if(assignType.is(existed.type)){
                        existed.type = assignType;
                        existed.desc = rDesc;
                        condition.warn(1186, condition.raw())
                    }
                }else{
                    scope.setPredicate(lDesc, Predicate.create(assignType, rDesc, this, cacheId))
                }
            }
        }else if(pp.isVariableDeclarator){
            let scope = this.scope;
            let assignType = type.inferType(); 
            let rDesc = type.value.description();
            if(assignType.isComputeType){
                assignType = assignType.getComputeType(null, this.getContext())
            }
            let dataset = scope.define('#predicate-type#');
            if(!dataset){
                dataset = new Map();
                scope.define('#predicate-type#', dataset, true)
            }
            dataset.set(pp, [lDesc, assignType, rDesc, this])
        }
    }
    
    parser(){
        if(super.parser()===false)return false;

        if(this.genericity && this.genericity.length>0){
            this.genericity.forEach(item=>{
                item.parser();
            });
        }
        
        //包裹对象元素应该在之后解析，因为可能在包裹对象中依赖泛类型。泛类型的推导依赖描述符，所以在没有解析之前有可能拿不到正确的描述符，最终可能无法推导出正确的类型。
        this.arguments.forEach((item)=>{
            if(!(item.isFunctionExpression /*|| item.isObjectExpression || item.isArrayExpression*/)){
                item.parser();
                item.setRefBeUsed();
            }
        });

        this.callee.parser();
        this.callee.setRefBeUsed();
        this.parserArguments();

        const whenThrow = this.callee.isMemberExpression ? this.callee.property : this.callee;

        let description = this.descriptor()
        if( !description ){
            whenThrow.error(1006,this.value());
            return true;
        }else if(this.is(description) && (description.isMethodDefinition || description.isFunctionExpression)){
            description.parser()
        }else if(description.isAnyType || description===Namespace.globals.get('Function')){
            return true;
        }

        if( description.isMethodDefinition || (description.isFunctionExpression && !description.isDeclaratorFunction)){
            if(description.isNoop){
                whenThrow.unnecessary(1185);
            }else{
                let fnStatement = description.isMethodDefinition ? description.expression : description;
                if(fnStatement && fnStatement.body && fnStatement.body.isBlockStatement){
                    if(fnStatement.body.body.length===0){
                        whenThrow.unnecessary(1185);
                    }
                }
            }
        }

        const context = this.getContext();
        const [declareGenerics, classGenerics] = this.getDeclareGenerics(description);
        const declareParams = this.getFunDeclareParams(description);
        const declareTypeParams = declareParams;
        const length = declareParams.length;
        const args = this.arguments;

        if( this.genericity ){
            const last = this.genericity[ this.genericity.length-1 ];
            if( declareGenerics.length < 1 ){
                last.error(1004,0,this.genericity.length);
            }else{
                const requires = declareGenerics.filter( item=>!item.isGenericTypeAssignmentDeclaration );
                if( requires.length > this.genericity.length ){
                    if( requires.length === declareGenerics.length ){
                        last.error(1004,requires.length,this.genericity.length);
                    }else{
                        last.error(1005,requires.length,declareGenerics.length,this.genericity.length);  
                    }
                }
                this.genericity.forEach((item,index)=>{
                    const declareType = declareGenerics[index] && declareGenerics[index].type();
                    if( declareType ){
                        if( declareType.hasConstraint ){
                            const constraint = declareType.inherit.type();
                            if( !constraint.check(item, context) ){
                                item.error(1003, item.type().toString(context), constraint.toString(context) );
                            }
                        }
                    }
                });
            }
        }

        const requireParams = declareParams.filter( item=>!(item.question || item.isAssignmentPattern || item.isRestElement) );
        const requireCount = requireParams.length;
        const argsLength = args.length;
        let hasRest = false;

        this.presetPredicateType(declareParams, args)

        if( length > 0 ){

            const checkArguments = (index, args, declareParams, declareTypes, top=false)=>{
                let checkResult = true;
                for(;index<args.length; index++){
                    const argument = args[index];
                    const argumentType = argument.type();
                    const declareParamType = declareTypes[index];
                    const declareParamItem = declareParams[index];
                    if( !(declareParamType && declareParamItem) )continue;
                    let acceptType = declareParamType.type();

                    let inferCtx = context.create(declareParamItem, acceptType)
                    if(acceptType.isGenericType && acceptType.hasConstraint){
                        const constraint = acceptType.inherit.type();
                        if(!constraint.check(argument, inferCtx)){
                            argument.error(1003, acceptType.toString(inferCtx), constraint.toString(inferCtx) );
                        }
                    }

                    if( argument.isSpreadElement ){
                        if(top)hasRest = true;
                        if( !argumentType.isAnyType ){
                            if( !(argumentType.isTupleType || argumentType.isLiteralArrayType || Namespace.globals.get('array').is(argumentType) ) ){
                                argument.error(1154);
                                return false;
                            }else{
                                if( declareParamItem.isRestElement ){
                                    checkResult = this.checkArgumentItemType(argument, declareParamItem, acceptType, inferCtx);
                                }else{
                                    return checkArguments(index, argumentType.elements, declareParams, declareTypes);
                                }
                            }
                        }
                    }else{

                        const isRest = acceptType && acceptType.target && acceptType.target.isTypeTupleRestDefinition;
                        if(isRest || declareParamItem.isRestElement){
                            if(top)hasRest = true;
                            let restParamType = acceptType;
                            let result = true;
                            for(;index<args.length;index++){
                                let argument = args[index];
                                const res = restParamType.elements.some( declare=>{
                                    const acceptType = declare.type();
                                    if( acceptType.isTupleType && argument.isArrayExpression || argument.isObjectExpression){
                                        return this.checkArgumentItemType(argument, declare, acceptType, inferCtx);
                                    }else{
                                        return acceptType.check(argument, inferCtx);
                                    }
                                });
                                if( !res ){
                                    argument.error(1002,  argument.type().toString( inferCtx ), restParamType.toString( inferCtx ) );
                                    result= false; 
                                }
                            }
                            return result;
                        }else{
                            let res = this.checkArgumentItemType(argument, declareParamItem, acceptType, inferCtx);
                            if(!res){
                                checkResult = false;
                            }
                        }
                    }
                }
                return checkResult;
            };
            checkArguments(0, args, declareParams, declareTypeParams, true);
        }

        if( !hasRest ){
            if( requireCount > 0 && argsLength < requireCount || length < argsLength ){
                whenThrow.error(1000,requireCount,argsLength);
            }
        }
    }

    value(){
        return this.callee.value();
    }

    raw(){
        return this.callee.raw();
    }
}

module.exports = CallExpression;