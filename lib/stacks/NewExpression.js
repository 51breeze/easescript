const Utils = require("../core/Utils");
const Expression = require("./Expression");
const Stack = require("../core/Stack");
const InstanceofType = require("../types/InstanceofType");
const keySymbol = Symbol("key");
class NewExpression extends Expression{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isNewExpression= true;
        this.callee = this.createTokenStack( compilation, node.callee, scope, node,this );
        this.arguments = node.arguments.map( item=>{
            return this.createTokenStack( compilation, item, scope, node,this );
        });
        this.genericity=null;
        if( node.genericity ){
            this.genericity = node.genericity.map(item=>this.createTokenStack(compilation,item,scope,node,this));
        }
        this[keySymbol]={};
    }
    freeze(){
        super.freeze();
        super.freeze( this.arguments );
        super.freeze( this.genericity );
        this.callee.freeze();
        this.arguments.forEach( stack=>stack.freeze() );
        (this.genericity || []).forEach( stack=>stack.freeze() );
    }
    definition(){

        const ctx = this.getContext();
        const [classModule, methodConstructor] = this.getConstructMethod( this.callee.type() )
        if( methodConstructor ){
            return methodConstructor.definition(ctx);
        }

        if( classModule && classModule.isModule ){
            const stack = classModule.moduleStack;
            if( stack ){
                const typeString = classModule.toString(ctx);
                return {
                    kind:"constructor",
                    comments:classModule.comments,
                    expre:`(constructor) ${typeString}(): ${typeString}`,
                    location:stack.id.getLocation(),
                    file:stack.file,
                };
            }
        }
        return null;
    }

    reference(){
        return this;
    }
    referenceItems(){
        return [this];
    }
    description(){
        let desc = this.callee.description();
        if( !desc ){
            return null;
        }
        if( desc.isDeclarator && desc instanceof Stack ){
            desc = desc.description();
        }
        return desc;
    }

    getConstructMethod(type, assigmentGenerics){
        let result = [];
        if( !type || type.isAnyType){
            return result;
        }
        if( type.isClassGenericType && type.isClassType ){
            return this.getConstructMethod(type.types[0].type(), assigmentGenerics)
        }else if( type.isClassGenericType ){
            return this.getConstructMethod(type.inherit.type(), type.types );
        }else if( Utils.isClassType(type) ){
            this.compilation.addDependency(type,this.module);
            result = [type, this.getMatchDescriptor('constructor', type), assigmentGenerics];
        }else{
            result = [type, null, assigmentGenerics];
        }
        return result;
    }

    getInstanceType(){
        return this.getAttribute('NewExpression.getInstanceType',()=>{
            let type = this.callee.type();
            if(!type || type.isAnyType)return this.getGlobalTypeById('any');
            let [classModule, method, assigns] = this.getConstructMethod(type);
            if( method ){
                const result = method.getReturnedType();
                if(result){
                    const [_type, _method, _assigns] = this.getConstructMethod(result.type());
                    if( _type )classModule = _type.type();
                    if(!assigns && _assigns)assigns = _assigns;
                }
            }
            if( this.genericity ){
                assigns = this.genericity.map( item=>item.type() );
            }
            return new InstanceofType(classModule, this, assigns||[], false);
        });
    }

    getContext(){
        const ctx = super.getContext();
        const type = this.getInstanceType();
        ctx.make(type);
        return ctx;
    }

    type(){
        return this.getInstanceType();
    }

    async parserArguments(){
        await this.allSettled(this.arguments,async item=>{
            await item.parser();
            item.setRefBeUsed();
        });
    }

    getFunDeclareParams(){
        const type = this.callee.type();
        const [classModule,methodConstructor] = this.getConstructMethod(type);
        return methodConstructor && methodConstructor.params || [];
    }

    async parser(){
        return await this.callParser(async ()=>{

            await this.callee.parser();
            this.callee.setRefBeUsed();

            const description = this.description();
            if( !description ){
                await this.parserArguments();
                return true;
            }

            const type = this.callee.type();
            if( !type || type.isAnyType ){
                await this.parserArguments();
                return true;
            }

            const [classModule,methodConstructor] = this.getConstructMethod(type);

            if( !classModule ){
                this.callee.error(1069,this.callee.value());
                await this.parserArguments();
                return true;
            }

            if(classModule.abstract){
                this.callee.error(1070,this.callee.value());
            }

            const args = this.arguments;
            var argsLength = args.length;
            var requireCount = 0
            var length = 0
            var hasRest = false;

            const context = super.getContext();
            const moduleStack = classModule.moduleStack;
            const declareGenerics = moduleStack && moduleStack.genericity ? moduleStack.genericity.elements : [];
            const hasDeclareGenerics = declareGenerics && declareGenerics.length > 0;

            if(moduleStack && hasDeclareGenerics)context.merge(moduleStack.getContext());
            if( methodConstructor ){
            
                const declareParams  = methodConstructor.params || [];
                const declareTypeParams = declareParams;
                const requireParams = declareParams.filter( item=>!(item.question || item.isAssignmentPattern || item.isRestElement) );
                
                length = declareParams.length;
                requireCount = requireParams.length;
            
                if( this.genericity ){
                    const lastStack = this.genericity[ this.genericity.length-1 ];
                    if( declareGenerics.length < 1 ){
                        lastStack.error(1004,0,this.genericity.length);
                    }
                    const requires = declareGenerics.filter( item=>!item.isGenericTypeAssignmentDeclaration );
                    if( requires.length > this.genericity.length ){
                        if( requires.length === declareGenerics.length ){
                            lastStack.error(1004,requires.length,this.genericity.length);
                        }else{
                            lastStack.error(1005,requires.length,declareGenerics.length,this.genericity.length);
                        }
                    }
                    await this.allSettled(this.genericity,async (item,index)=>{
                        await item.parser();
                        const declareType = declareGenerics[index] && declareGenerics[index].type();
                        if( declareType && declareType.hasConstraint && !declareType.check(item, context) ){
                            item.error(1003, item.type().toString(context), declareType.inherit.type().toString(context) );
                        }
                    });
                    await this.parserArguments();
                }else if( hasDeclareGenerics ){
                    await this.parserArguments();
                    context.extracts(declareParams, args);
                }else{
                    await this.parserArguments();
                }
            
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
                            if( this.isGenericsRelationValue(acceptType, declareGenerics, this.genericity) ){
                                continue;
                            }
                            let _ctx = context;
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
                                    for(;index<args;index++){
                                        let argument = args[index];
                                        const res = restParamType.elements.some( declare=>{
                                            const acceptType = declare.type();
                                            if( acceptType.isTupleType && argument.isArrayExpression || argument.isObjectExpression){
                                                return this.checkArgumentItemType(argument, declare, acceptType, _ctx);
                                            }else{
                                                return acceptType.check(argument, ctx);
                                            }
                                        });
                                        if( !res ){
                                            argument.error(1002, argument.type().toString(_ctx ), restParamType.toString( _ctx ) );
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

            }else{
                this.parserArguments();
            }

            const insType = this.getInstanceType();
            if( !(insType.generics.length > 0) && declareGenerics.length > 0){
                const assignGenerics = declareGenerics.map( decl=>{
                    return context.apply( decl.type() )
                });
                insType.generics = assignGenerics;
            }

            if( !hasRest ){
                if( requireCount > 0 && argsLength < requireCount || length < argsLength ){
                    this.callee.error(1000,requireCount,argsLength);
                }
            }

        }, await super.parser())
    }

    value(){
        return this.callee.value();
    }
}

module.exports = NewExpression;