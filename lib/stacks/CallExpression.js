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
        const description= this.description(true);
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
        const def = description.definition(context);
        return def;
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
        if( Utils.isTypeModule(desc) ){
            this.compilation.addDependency(desc,this.module );
        }
        if( desc && Utils.isClassType(desc) && desc.callable){
            desc = desc.callable;
        }
        return desc;
    }

    value(){
        return this.callee.value();
    }

    getDeclareFunctionType(description){
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
        }
        if( description.isAliasType ){
            description = this.getDeclareFunctionType( description.inherit.type() );
        }
        return description;
    }

    getFunDeclareParams( description ){
        if(!description)return [];
        const declareParams = description.isFunctionType && description.target ? description.target.params : description.params;
        return declareParams || [];
    }

    getDeclareGenerics(description){
        const genericity = description.isFunctionType && description.target ? description.target.genericity : description.genericity;
        const classModule = description.isFunctionType && description.target ? description.target.module : description.module;
        const classGenerics = Utils.isTypeModule(classModule) ? classModule.moduleStack.genericity : null;
        return [genericity ? genericity.elements : [],classGenerics];
    }

    getRawType(){
        const type = this.type();
        return this.getAttribute('CallExpression.getRawType') || type;
    }

    type(){
        return this.getAttribute('CallExpression.type',()=>{
            let description = this.description();
            if(description){
                let type = null;
                description = this.getDeclareFunctionType(description);
                // if( description.isConstructor ){
                //     type = Namespace.globals.get(description.module.id.toLowerCase());
                //     if( type ){
                //         return type;
                //     }
                // }
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

                if(type){

                    if( type.isInstanceofType && type.isThisType ){
                        if( this.callee.isMemberExpression ){
                            type = this.callee.object.type();
                            this.setAttribute('CallExpression.getRawType', type);
                            return type;
                        }
                    }

                    this.setAttribute('CallExpression.getRawType', type);
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
                }
                
            }
            return this.getGlobalTypeById('any');
        });
    }

    parserArguments(){
         this.arguments.forEach((item)=>{
            item.parser();
            item.setRefBeUsed();
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
        this.callee.parser();
        this.callee.setRefBeUsed();
        let description = this.getDeclareFunctionType( this.description() )
        if( !description || description.isAnyType || (Utils.isClassType(description) && description.getName() ==='Function') ){
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
                whenThrow.warn(1185);
            }else{
                let fnStatement = description.isMethodDefinition ? description.expression : description;
                if(fnStatement && fnStatement.body && fnStatement.body.isBlockStatement){
                    if(fnStatement.body.body.length===0){
                        whenThrow.warn(1185);
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
                    item.parser();
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
            
            this.parserArguments();
            context.extracts(declareParams, args, declareGenerics);
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