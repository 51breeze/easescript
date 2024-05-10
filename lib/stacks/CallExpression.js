const Utils = require("../core/Utils");
const Expression = require("./Expression");
const Stack = require("../core/Stack");
const Namespace = require("../core/Namespace");
const keySymbol = Symbol("key");
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
        this[keySymbol]={};
    }

    freeze(){
        super.freeze(this);
        this.callee.freeze();
        super.freeze(this.genericity);
        (this.genericity || []).forEach( stack=>stack.freeze() );
    }

    definition(){
        const identifier = this.callee.value();
        let description= this.description();
        if( !description && this.parentStack.isWhenStatement ){
            const type = 'boolean';
            const params  =  this.arguments.map( (item)=>item.value() );
            return {
                comments:this.comments,
                expre:`(method) ${identifier}(${params.join(",")}):${type}`,
                location:this.callee.getLocation(),
                file:this.compilation.file
            };
        }

        if( !description )return null;
        if( description && (description.isType && description.isAnyType) ){
            return {
                expre:`any`,
            };
        }
        const context = this.getContext();
        if(description.isDeclaratorVariable){
            const desc = this.getDeclareFunctionType(description);
            const def = desc.definition(context);
            if(def && def.expre.startsWith('(method)')){
                def.expre = `(alias ${description.id})${def.expre.slice(8)}`
            }
            return def;
        }else if(Utils.isTypeModule(description) && description !== Namespace.globals.get('Function')){
            description = this.getDeclareFunctionType(description);
        }
        
        return description.definition(context);
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
        let desc = this.callee.description();
        if( !desc )return this.getGlobalTypeById("any");
        return desc;
    }

    value(){
        return this.callee.value();
    }

    doGetDeclareFunctionType(description){
        if(!description)return null;
        if( description.isTypeObjectPropertyDefinition ){
            description = description.type();
        }else if( description.isPropertyDefinition ){
            description = description.type();
        }else if( description.isTypeObjectPropertyDefinition ){
            description = description.type();
        }else if( description.isProperty && !description.hasAssignmentPattern){
            description = description.type();
        }else if( description.isDeclarator ){
            description = description.type();
        }else if( description.isImportDeclaration ){
            description = description.type();
        }
        if(description){
            if( description.isAliasType && !Utils.isGlobalShortenType(description) ){
                description = this.getDeclareFunctionType( description.inherit.type() );
            }
            if( description.isDeclaratorVariable ){
                const type = description.declarations[0].type();
                if(type.isClassGenericType){
                    this.getContext().make(type);
                }
                const origin =Utils.getOriginType(type);
                if(origin === Namespace.globals.get('Function')){
                    return origin;
                }
                if(Utils.isTypeModule(origin)){
                    return this.getMatchDescriptor(`#${origin.id}`, origin)
                }
            }else if(Utils.isTypeModule(description) && description !== Namespace.globals.get('Function')){
                return this.getMatchDescriptor(`#${description.id}`, description)
            }
        }
        return description;
    }

    getDeclareFunctionType(type){
        if(!type)return null;
        return this.getAttribute('CallExpression.getDeclareFunctionType',()=>this.doGetDeclareFunctionType(type),type);
    }

    getFunDeclareParams( description=null ){
        if(!description){
            description = this.getDeclareFunctionType(this.description())
        }
        const declareParams = description.isFunctionType && description.target ? description.target.params : description.params;
        return declareParams || [];
    }

    getDeclareGenerics(description){
        const genericity = description.isFunctionType && description.target ? description.target.genericity : description.genericity;
        const classModule = description.isFunctionType && description.target ? description.target.module : description.module;
        const classGenerics = Utils.isTypeModule(classModule) ? classModule.moduleStack.genericity : null;
        return [genericity ? genericity.elements : [],classGenerics];
    }

    getCalleeDeclareGenerics(){
        const description = this.getDeclareFunctionType(this.description())
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

    type(){
        return this.getAttribute('CallExpression.type',()=>{
            let description = this.description();
            if(!description){
                return Namespace.globals.get('any');
            }

            let type = null;
            description = this.getDeclareFunctionType(description);
            if(description.isMethodDefinition || description.isFunctionExpression){
                const result = description.getReturnedType();
                if(result){
                    type = result.type()
                }
            }else{
                let result = description.type();
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
            
            const context = this.getContext();
            
            let final = context.apply(type);
            if( final.isInstanceofType && final.target && final.target.isNewExpression){
                const inherit = final.inherit.type();
                if(inherit.isClassGenericType && inherit.isClassType){
                    final = inherit.elements[0].type();
                    this.setAttribute('CallExpression.getRawType', final);
                }
            }
            
            context.make(final);
            return final;
            
        });
    }

    parserArguments(){
        this.arguments.forEach((item)=>{
            if(item.isFunctionExpression /*|| item.isObjectExpression || item.isArrayExpression*/){
                item.parser();
                item.setRefBeUsed();
            }
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

        let description = this.getDeclareFunctionType(this.description());
        if(!description || description.isAnyType || description===Namespace.globals.get('Function')){
            this.parserArguments();
            return true;
        }

        const whenThrow = this.callee.isMemberExpression ? this.callee.property : this.callee;

        if( !this.isCallableDesc(description) ){
            whenThrow.error(1006,this.value());
            this.parserArguments();
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
                    //item.parser();
                    const declareType = declareGenerics[index] && declareGenerics[index].type();
                    if( declareType ){ 
                        context.setValue(declareType, item);
                        if( declareType.hasConstraint ){
                            const constraint = declareType.inherit.type();
                            if( !constraint.check(item, context) ){
                                item.error(1003, item.type().toString(context), constraint.toString(context) );
                            }
                        }
                    }
                });
            }
            this.parserArguments();
        /*}else if( declareGenerics.length > 0 || classGenerics){ 
            this.parserArguments();
            context.extracts(declareParams, args, declareGenerics);*/
        }else{
            context.extracts(declareParams, args, declareGenerics, false);
            this.parserArguments();
        }

        const requireParams = declareParams.filter( item=>!(item.question || item.isAssignmentPattern || item.isRestElement) );
        const requireCount = requireParams.length;
        const argsLength = args.length;
        let hasRest = false;

        if( length > 0 ){
            const checkArguments = (index, args, declareParams, declareTypes, top=false)=>{
                let checkResult = true;
                for(;index<args.length; index++){
                    const argument = args[index];
                    const argumentType = argument.type();
                    const declareParamType = declareTypes[index];
                    const declareParamItem = declareParams[index];
                    if( !(declareParamType && declareParamItem) )continue;
                    let _ctx = context;
                    let acceptType = declareParamType.type();
                    if( this.isGenericsRelationValue(acceptType, declareGenerics, this.genericity) ){
                       continue;
                    }

                    if( acceptType && acceptType.isGenericType ){
                        acceptType = context.fetch(acceptType, true);
                    }

                    if(acceptType && acceptType.isClassGenericType){
                        _ctx = context.createChild(argument);
                        _ctx.assignment(acceptType);
                    }

                    if( argument.isSpreadElement ){
                        if(top)hasRest = true;
                        if( !argumentType.isAnyType ){
                            if( !(argumentType.isTupleType || argumentType.isLiteralArrayType || Namespace.globals.get('array').is(argumentType) ) ){
                                argument.error(1154);
                                return false;
                            }else{
                                if( declareParamItem.isRestElement ){
                                    checkResult = this.checkArgumentItemType(argument, declareParamItem, acceptType, _ctx);
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
                                        return this.checkArgumentItemType(argument, declare, acceptType, _ctx);
                                    }else{
                                        return acceptType.check(argument, _ctx);
                                    }
                                });
                                if( !res ){
                                    argument.error(1002,  argument.type().toString( _ctx ), restParamType.toString( _ctx ) );
                                    result= false; 
                                }
                            }
                            return result;
                        }else{
                            if( !this.checkArgumentItemType(argument, declareParamItem, acceptType, _ctx) ){
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