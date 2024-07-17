const Utils = require("../core/Utils");
const Expression = require("./Expression");
const InstanceofType = require("../types/InstanceofType");
const Namespace = require("../core/Namespace");
const Module = require("../core/Module");
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
        const desc = this.description();
        const [classModule, methodConstructor] = this.getConstructMethod( this.callee.type() )
        let def = null;
        if(methodConstructor && desc){
            if(desc.isImportDefaultSpecifier || desc.isImportNamespaceSpecifier || desc.isImportSpecifier){
                return this.definitionMergeToArray(desc.definition(ctx), methodConstructor.definition(ctx));
            }
            def = methodConstructor.definition(ctx);
        }
        if(Module.is(classModule)){
            return this.definitionMergeToArray(classModule.getStacks().map(stack=>stack.definition(ctx)), def);
        }
        return def;
    }

    reference(){
        return this;
    }
    referenceItems(){
        return [this];
    }
    description(){
        return this.callee.description();
    }

    descriptor(){
        let [classModule,method] = this.getConstructMethod() || [];
        if(!classModule)return null;
        return method || Namespace.globals.get('any');
    }

    doGetConstructMethod(type, assigmentGenerics, exclude=null){
        let result = [];
        if(type===exclude)return null;
        if(!type || type.isAnyType){
            if(exclude)return null;
            return [type];
        }

        if(type.isLiteralObjectType){
            let method = this.getMatchDescriptor('#new#', type);
            return [type, method, assigmentGenerics];
        }

        if(type.isTypeofType){
            return this.doGetConstructMethod(type.origin.type(), assigmentGenerics, type);
        }else if(type.isIntersectionType){
            let lResult = this.doGetConstructMethod(type.left.type(), assigmentGenerics, type);
            if(lResult && lResult[1]){
                return lResult;
            }
            let rResult = this.doGetConstructMethod(type.right.type(), assigmentGenerics, type);
            if(rResult && rResult[1]){
                return rResult;
            }
            return lResult[0] ? lResult : rResult;
        }else if(type.isUnionType){
            const els = type.elements;
            let last = null;
            for(let index=0; index<els.length;index++){
                let res = this.doGetConstructMethod(els[index].type(), assigmentGenerics, type)
                if(res){
                    last = res;
                    if(res[1])return res;
                }
            }
            return last;
        }
        if( type.isClassGenericType && type.isClassType ){
            return this.doGetConstructMethod(type.types[0].type(), assigmentGenerics, type)
        }else if(type.isClassGenericType){
            return this.doGetConstructMethod(type.inherit.type(), type.types, type);
        }else if(Utils.isTypeModule(type) && (type.isClass || type.isInterface)){
            this.compilation.addDependency(type,this.module);
            let method = this.getMatchDescriptor('constructor', type);
            result = [type, method, assigmentGenerics];
        }else{
            result = [type, null, assigmentGenerics];
        }
        return result;
    }

    getConstructMethod(type){
        const records = this.__records || (this.__records = new Map());
        const desc = this.description()
        if(!desc)return [];
        type = type || this.callee.type();
        if(records.has(type)){
            return records.get(type);
        }
        let res = this.doGetConstructMethod(type);
        records.set(type, res);
        return res;
    }

    getInstanceType(){
        return this.getAttribute('NewExpression.getInstanceType',()=>{
            const ctx = super.getContext();
            const anyType = Namespace.globals.get('any');
            let type = ctx.inferValue(this.callee.type());
            if(!type || type.isAnyType)return anyType;
            let [classModule, method, assigns] = this.getConstructMethod(type);
            let origin = classModule;
            if(method){
                const result = method.getReturnedType();
                if(result){
                    const assignType = result.type();
                    const [_type, _method, _assigns] = this.getConstructMethod(assignType);
                    if(_type && _type !== classModule){
                        if(assignType && assignType.isClassGenericType){
                            return assignType;
                        }
                    }
                    if( _type ){
                        classModule = _type.type();
                    }
                    if(_assigns)assigns = _assigns;
                }
            }
            if(this.genericity && origin === classModule){
                assigns = this.genericity.map(item=>item.type());
            }else{
                if(!assigns || !assigns.length){
                    let [,declareGenerics] = this.getDeclareGenerics(classModule);
                    if(declareGenerics && declareGenerics.length){
                        assigns = declareGenerics.map(decl=>ctx.inferValue(decl.type()) || anyType)
                    }
                }else{
                    assigns = assigns.map( item=>ctx.inferValue(item.type()) || anyType)
                }
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

    getRawType(){
        return this.getInstanceType();
    }

    type(){
        return this.getInstanceType();
    }

    parserArguments(){
        this.arguments.forEach( item=>{
            if( item.isFunctionExpression /* || item.isObjectExpression || item.isArrayExpression */){
                item.parser();
                item.setRefBeUsed();
            }
        });
    }

    getFunDeclareParams(){
        const type = this.callee.type();
        const [classModule,methodConstructor] = this.getConstructMethod(type);
        return methodConstructor && methodConstructor.params || [];
    }

    getDeclareGenerics(classModule,methodConstructor){
        if(methodConstructor && (methodConstructor.isMethodDefinition || methodConstructor.isNewDefinition) && methodConstructor.genericity){
            return [methodConstructor, methodConstructor.genericity.elements];
        }else if(methodConstructor && methodConstructor.isFunctionType){
            return [methodConstructor.target||methodConstructor, methodConstructor.generics];
        }
        if(classModule.isModule && (classModule.isClass || classModule.isInterface)){
            return classModule.getModuleDeclareGenerics(false,false,true);
        }
        return [classModule.moduleStack, []];
    }

    getCalleeDeclareGenerics(){
        const [classModule, methodConstructor] = this.getConstructMethod(this.callee.type());
        if(methodConstructor && (methodConstructor.isMethodDefinition || methodConstructor.isNewDefinition) && methodConstructor.genericity){
            return methodConstructor.genericity.elements.map(item=>item.type())
        }else if(methodConstructor && methodConstructor.isFunctionType){
            return [methodConstructor.target||methodConstructor, methodConstructor.generics];
        }
        if(classModule.isModule && (classModule.isClass || classModule.isInterface)){
            const value =  classModule.getModuleDeclareGenerics();
            if(value && value.length>0){
                return value;
            }
        }
        return null
    }

    getAssigmentGenerics(){
        const assigments = this.genericity;
        if(assigments)return assigments;
        const type = this.callee.type();
        const [,,assigmentGenerics] = this.getConstructMethod(type);
        return assigmentGenerics || null;
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
        
        const [classModule,methodConstructor, assigmentGenerics] = this.getConstructMethod() || [];
        if( !classModule ){
            this.callee.error(1069,this.callee.value());
            this.parserArguments();
            return true;
        }

        if(classModule.isAnyType){
            this.parserArguments();
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
        const [moduleStack, declareGenerics] = this.getDeclareGenerics(classModule, methodConstructor);
        const hasDeclareGenerics = declareGenerics && declareGenerics.length > 0;

        if(moduleStack && moduleStack.isStack && hasDeclareGenerics){
            context.merge(moduleStack.getContext());
            if(classModule.isModule && classModule.isClass){
                classModule.getStacks().forEach( stack=>{
                    if(stack !== moduleStack){
                        context.merge(stack.getContext());
                    }
                })
            }
        }

        if( methodConstructor ){
        
            const declareParams  = methodConstructor.params || [];
            const declareTypeParams = declareParams;
            const requireParams = declareParams.filter( item=>!(item.question || item.isAssignmentPattern || item.isRestElement) );
            length = declareParams.length;
            requireCount = requireParams.length;
            const _assigmentGenerics = this.genericity || assigmentGenerics;
            if( _assigmentGenerics && _assigmentGenerics.length>0 ){
                const lastStack = _assigmentGenerics[ _assigmentGenerics.length-1 ];
                if( declareGenerics.length < 1 ){
                    lastStack.error(1004,0,_assigmentGenerics.length);
                }
                const requires = declareGenerics.filter( item=>!item.isGenericTypeAssignmentDeclaration );
                if( requires.length > _assigmentGenerics.length ){
                    if( requires.length === declareGenerics.length ){
                        lastStack.error(1004,requires.length,_assigmentGenerics.length);
                    }else{
                        lastStack.error(1005,requires.length,declareGenerics.length,_assigmentGenerics.length);
                    }
                }

                _assigmentGenerics.forEach( (item,index)=>{
                    //item.parser();
                    const declareType = declareGenerics[index] && declareGenerics[index].type();
                    if( declareType ){ 
                        //context.setValue(declareType, item);
                        context.extract(declareType, item, declareGenerics);
                        if( declareType.hasConstraint ){
                            const constraint = declareType.inherit.type();
                            if( !constraint.check(item, context) ){
                                item.error(1003, item.type().toString(context), constraint.toString(context) );
                            }
                        }
                    }
                });
                this.parserArguments();
            /*}else if( hasDeclareGenerics ){
                this.parserArguments();
                context.extracts(declareParams, args, declareGenerics);*/
            }else{
                context.extracts(declareParams, args, declareGenerics, false);
                this.parserArguments();
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
                        if( this.isGenericsRelationValue(acceptType, declareGenerics, _assigmentGenerics) ){
                            if(acceptType.hasConstraint && !_assigmentGenerics){
                                const constraint = acceptType.inherit.type();
                                if(!constraint.hasGenericType){
                                    let _ctx = declareParamItem.getContext().createChild(argument);
                                    if(!constraint.check(argument, _ctx)){
                                        argument.error(1003, argument.type().toString(_ctx), constraint.toString(_ctx) );
                                    }
                                }
                            }
                            continue;
                        }

                        if( acceptType && acceptType.isGenericType ){
                            acceptType = context.fetch(acceptType, true);
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
        let inherit = insType.inherit;
        let newType = context.apply(inherit);
        if( newType !== inherit ){
            insType.extends =newType;
        }
        
        // if( !(insType.generics.length > 0) && declareGenerics.length > 0){
        //     const assignGenerics = declareGenerics.map( decl=>{
        //         return context.apply( decl.type() )
        //     });
        //     insType.generics = assignGenerics;
        // }

        if( !hasRest ){
            if( requireCount > 0 && argsLength < requireCount || length < argsLength ){
                this.callee.error(1000,requireCount,argsLength);
            }
        }
    }

    value(){
        return this.callee.value();
    }
}

module.exports = NewExpression;