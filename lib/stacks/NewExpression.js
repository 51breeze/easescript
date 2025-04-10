const Utils = require("../core/Utils");
const Expression = require("./Expression");
const InstanceofType = require("../types/InstanceofType");
const Namespace = require("../core/Namespace");
const Module = require("../core/Module");
const MergeType = require("../core/MergeType");
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
    definition(context){
        const ctx = this.getContext();
        if(context){
            ctx.setHoverStack(context.hoverStack)
        }
        const [classModule, methodConstructor] = this.getConstructMethod( this.callee.type());
        if(methodConstructor){
            if(Module.is(classModule)){
                let descriptors = (classModule.descriptors.get('constructor') || []).filter(item=>item !== methodConstructor);
                return [methodConstructor.definition(ctx), ...descriptors.map(item=>item.definition(ctx))];
            }
            return methodConstructor.definition(ctx);
        }
        if(Utils.isModule(classModule)){
            return classModule.definition(ctx);
        }
        const desc = this.description();
        if(desc){
            return desc.definition(ctx);
        }
        return null;
    }

    hover(context){
        const ctx = this.getContext();
        const desc = this.description();
        if(context){
            ctx.setHoverStack(context.hoverStack)
        }
        if(desc){
            return desc.hover(ctx);
        }
        const def = {
            expre:`new ${this.value()}`,
        };
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
            let assigment = type.types[0].type();
            if(assigment.isAnyType){
                result = [assigment];
            }else{
                return this.doGetConstructMethod(assigment, assigmentGenerics, type)
            }
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

    getConstructMethod(type=null){
        const records = this.__records || (this.__records = new Map());
        const desc = this.description()
        if(!desc)return [];
        if(!type){
            type = this.callee.type();
        }
        if(records.has(type)){
            return records.get(type);
        }
        let res = this.doGetConstructMethod(type);
        records.set(type, res);
        return res;
    }

    getInstanceType(){
        return this.getAttribute('NewExpression.getInstanceType',()=>{
            const inferContext = this.getContextOfInference()
            let type = this.callee.type();
            let [classModule, method, assigns] = this.getConstructMethod(type) || [type];
            let origin = classModule;
            if(method){
                const result = method.getReturnedType();
                if(result){
                    let assignType = result.type();
                    assignType = inferContext.fetch(assignType) || assignType
                    let [_type, _method, _assigns] = this.getConstructMethod(assignType);
                    if(_type && _type !== classModule){
                        if(assignType && assignType.isClassGenericType){
                            return assignType;
                        }
                    }
                    if( _type ){
                        classModule = _type.type();
                        if(classModule.isTupleType && !_assigns){
                            let res = classModule.elements.map(el=>inferContext.apply(el.type()))
                            _assigns = [res.length===1? res[0] : MergeType.arrayToUnion(res)];
                        }
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
                        assigns = declareGenerics.map(decl=>{
                            return inferContext.apply(decl.type())
                        })
                    }
                }else{
                    assigns = assigns.map( item=>{
                        return inferContext.apply(item.type())
                    })
                }
            }  
            return new InstanceofType(classModule||Namespace.globals.get('any'), this, assigns||[], false);
        });
    }

    getRawType(){
        return this.getInstanceType();
    }

    type(){
        return this.getInstanceType();
    }

    parserArguments(){
        this.arguments.forEach( item=>{
            item.parser();
            item.setRefBeUsed();
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
        if(classModule && classModule.isModule && (classModule.isClass || classModule.isInterface)){
            return classModule.getModuleDeclareGenerics(false,false,true);
        }
        return classModule ? [classModule.moduleStack, []] : [null, []];
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

        this.callee.parser();
        this.callee.setRefBeUsed();
        this.parserArguments();
        
        const [classModule,methodConstructor, assigmentGenerics] = this.getConstructMethod() || [];
        if( !classModule ){
            this.callee.error(1069,this.callee.value());
            return true;
        }

        if(classModule.isAnyType || classModule.isGenericType){
            return true;
        }

        if(classModule.abstract){
            this.callee.error(1070,this.callee.value());
            return true;
        }

        const args = this.arguments;
        var argsLength = args.length;
        var requireCount = 0
        var length = 0
        var hasRest = false;

        const context = super.getContext();
        const [moduleStack, declareGenerics] = this.getDeclareGenerics(classModule, methodConstructor);

        if( methodConstructor ){

            if(this.is(methodConstructor)){
                methodConstructor.parser()
            }
        
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
                    const declareType = declareGenerics[index] && declareGenerics[index].type();
                    if( declareType ){ 
                        if( declareType.hasConstraint ){
                            const constraint = declareType.inherit.type();
                            if(!constraint.check(item, context)){
                                item.error(1003, item.type().toString(context), constraint.toString(context) );
                            }
                        }
                    }
                });
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

                        let inferCtx = context.create(declareParamItem, acceptType)
                        if(acceptType.isGenericType){
                            if(acceptType.hasConstraint){
                                const constraint = acceptType.inherit.type();
                                if(!constraint.check(argument, inferCtx)){
                                    argument.error(1003, argument.type().toString(inferCtx), constraint.toString(inferCtx) );
                                }
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
                                for(;index<args;index++){
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
                                        argument.error(1002, argument.type().toString(inferCtx ), restParamType.toString( inferCtx ) );
                                        result= false;
                                    }
                                }
                                return result;
                            }else{
                                if( !this.checkArgumentItemType(argument, declareParamItem, acceptType, inferCtx) ){
                                    checkResult = false;
                                }
                            }
                        }
                    }
                    return checkResult;
                };
                checkArguments(0, args, declareParams, declareTypeParams, true);
            }
        }
        
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