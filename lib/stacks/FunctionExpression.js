const Utils = require("../core/Utils");
const Declarator = require("./Declarator");
const FunctionScope = require("../scope/FunctionScope");
const Expression = require("./Expression");
const FunctionType = require("../types/FunctionType");
const MergeType = require("../core/MergeType");
const InstanceofType = require("../types/InstanceofType");
const LiteralObjectType = require("../types/LiteralObjectType");
const keySymbol = Symbol("key");
const emptyProperties = new Map();
var objectThisType = null;
const getDefaultThisType = (target)=>{
    if(objectThisType)return objectThisType;
    return objectThisType = new Map([[
        target.getGlobalTypeById("string"),  
        target.getGlobalTypeById("any") 
    ]]);
}

class FunctionExpression extends Expression{
    constructor(compilation,node,scope,parentNode,parentStack){
        scope = new FunctionScope(scope); 
        super(compilation,node,scope,parentNode,parentStack);
        if( parentStack && parentStack.isMethodDefinition ){
            scope.isMethod=true;
            if( parentStack.isConstructor ){
                scope.isConstructor = true;
                this.isConstructor = true;
            }
            this.scope.define("arguments", this.getGlobalTypeById("IArguments") );
        }else if(node.type=='FunctionExpression'||node.type==="FunctionDeclaration"){
            this.scope.define("this", new LiteralObjectType(
                this.getGlobalTypeById("object"), 
                null, 
                emptyProperties, 
                getDefaultThisType(this)
            ));
            this.scope.define("arguments", this.getGlobalTypeById("IArguments") );
        }
        this.isFunctionExpression=true;
        this.genericity = this.createTokenStack(compilation,node.genericity,scope,node,this);
        this._returnType= this.createTokenStack(compilation,node.returnType,scope,node,this);
        this.hasReturnType = !!node.returnType;
        let assignment = null;
        let hasRest = null;
        this.params = node.params.map( item=>{
            if( item.type =="Identifier" ){
                const stack = new Declarator(compilation,item,scope,node,this);
                if( assignment && !stack.question ){
                    assignment.error(1050,assignment.value()); 
                }
                scope.define(stack.value(), stack);
                return stack;
            }else{
                const stack = this.createTokenStack(compilation,item,scope,node,this);
                if( stack.isRestElement ){
                    hasRest = stack;
                }
                assignment = stack;
                return stack;
            }
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
            ctx = {}
        }

        const token = this.parentStack.isProperty || this.parentStack.isMethodDefinition ? this.parentStack.key : this.key;
        const type = this.getReturnedType();
        const params  = this.params.map( item=>{
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
        const isFunDeclare = this.isDeclaratorFunction || this.isFunctionDeclaration || this.isArrowFunctionExpression;
        let kind = isFunDeclare || !this.parentStack.isMethodDefinition ? 'function' : 'method';
        const returnType = type ? type.toString(ctx) : 'void';
        const key = token ? token.value() : 'anonymous';
        if( this.isArrowFunctionExpression ){
            return {
                comments:this.comments,
                expre:`(${kind}) ${strGenerics}(${params.join(", ")})=>${returnType}`,
                location:this.getLocation(),
                file:this.compilation.file,
            };
        }

        return {
            comments:this.comments,
            expre:`(${kind}) ${key}${strGenerics}(${params.join(", ")}): ${returnType}`,
            location:token ? token.getLocation() : null,
            file:this.compilation.file,
        };
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

    get returnType(){
        return this.getAttribute('FunctionExpression.returnType',()=>{

            let returnResult = null;
            if( this._returnType  ){
                returnResult = this._returnType;
            }else{
                if( this.parentStack.isMethodDefinition ){
                    const module = this.parentStack.module;
                    const name = this.parentStack.value();
                    const kind = this.parentStack.isMethodGetterDefinition ? "get" : this.parentStack.isMethodSetterDefinition ? 'set' : null;
                    const getImpModule=(imps)=>{
                        if( !imps )return null;
                        for( var impModule of imps){
                            if( impModule && impModule !== module ){
                                const result = impModule.getMember(name, kind ) || getImpModule(impModule.implements) || getImpModule(impModule.extends);
                                if( result && result.returnType ){
                                    return result;
                                }
                            }
                        }
                        return null;
                    }
                    const result = getImpModule(module.implements) || getImpModule(module.extends);
                    if( result ){
                        returnResult = result.returnType;
                    }
                }else if(this.parentStack.isAssignmentExpression){
                    const type = this.parentStack.left.type();
                    if( type && type.isFunctionType ){
                        const result = type.target && (type.target.isFunctionExpression || type.target.isTypeFunctionDefinition) ? type.target._returnType : null;
                        if( result ){
                            returnResult = result.type();
                        }
                    }
                }else if( this.parentStack.isCallExpression ){
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
                }

            }
    
            if( returnResult ){
                this.getContext().make( returnResult.type() );
            }
    
            return returnResult;

        });
    }

    inferReturnType(){
        
        if( this.isArrowFunctionExpression && this.scope.isExpression ){
            return this.body.type();
        }

        return this.getAttribute('inferReturnType',()=>{

            const returnItems = this.scope.returnItems;
            if( !returnItems || !returnItems.length ){
                return this.getGlobalTypeById("void");
            }

            if( returnItems.length > 1 ){
                const mergeType = new MergeType();
                mergeType.keepOriginRefs = false;
                let breakContext = null;
                for(let item of returnItems ){
                    const desc = item.description();
                    if( desc && (desc === this || desc.expression === this)){
                        continue;
                    }
                    const ips = item.parentStack;
                    if( ips.isBlockStatement && ips.parentStack.isIfStatement ){
                        if( ips.parentStack.alternate === ips ){
                            if( ips.parentStack.parentStack && ips.parentStack.parentStack.parentStack === this ){
                                breakContext = ips.parentStack.parentStack;
                            }
                        }
                        mergeType.add( item.type() );
                    }else if( ips.isSwitchCase ){
                        mergeType.add( item.type() );
                    }
                    else{
                        if( breakContext === ips && ips.parentStack === this ){
                            break;
                        }
                        mergeType.add( item.type() );
                    }
                }
                return mergeType.type();
            }
            return MergeType.to(returnItems[0].type());
        });
    }

    normalization( type ){
        if( type && type.isUnionType ){
            if(type.elements.some( type=>{
                type = type.type();
                return type && type.isAnyType;
            })){
                return this.getGlobalTypeById("any");
            }
        }
        return type;
    }

    getReturnedType(){
        return this.getAttribute('getReturnedType',()=>{
            let type = this.returnType;
            let value = null;
            if( type ){
                value = this.normalization( type.type() );
            }else if( this.async ){
                const PromiseType = this.getGlobalTypeById("Promise");
                value = new InstanceofType( PromiseType, null, [ this.inferReturnType() ] );
            }else{
                value = this.inferReturnType();
            }
            return value;
        });
    }

    type(){
        return this.getFunType();
    }

    getFunType(){
        if( this.hasAttribute('getFunType') )return this.getAttribute('getFunType');
        return this.setAttribute('getFunType',new FunctionType(this.getGlobalTypeById("Function"), this));
    }

    parser(){
        if(super.parser()===false)return false;
        if( this.parentStack && this.parentStack.isMethodDefinition ){
            this.scope.define("arguments", this.getGlobalTypeById("IArguments") );
        }else if(!this.isArrowFunctionExpression){
            this.scope.define("this", new LiteralObjectType(
                this.getGlobalTypeById("object"), 
                null, 
                emptyProperties, 
                getDefaultThisType(this)
            ));
            this.scope.define("arguments", this.getGlobalTypeById("IArguments") );
        }

        if(this.genericity){
            this.genericity.parser();
            const ctx = this.getContext();
            ctx.declareGenerics(this.genericity);
        }

        this.params.forEach((item)=>{
            item.parser();
        });

        if(this._returnType){
            this._returnType.parser();
            this._returnType.setRefBeUsed();
        }

        if(this.body){
            this.body.parser();
        }
        
        if( this.parentStack && this.parentStack.parentStack && this.parentStack.parentStack.isUseExtendStatement ){
            return true;
        }

        if( !this.isDeclaratorFunction ){
            const ax = this.parentStack && this.parentStack.isAssignmentExpression;
            const isInterface = this.module && (this.module.isDeclaratorModule || this.module.isInterface);
            if( this.isConstructor && this.module && !isInterface && !this.module.callable ){
                if( this.scope.returnItems.length > 0 ){
                    const last = this.scope.returnItems[ this.scope.returnItems.length-1 ]
                    last.error(1052);
                }
                if( this.module.extends[0] && this.scope.firstSuperIndex != 1){
                    (this.body.childrenStack[0]||this.key).error(1053);
                }
            }else if( !isInterface && !ax ){
                let acceptType = this.returnType;
                if( acceptType ){
                    acceptType = acceptType.type();
                    const hasVoidType = (type)=>{
                        if(!type)return false;
                        if(type.isVoidType || type.isAnyType || type.isGenericType)return true;
                        return type.isUnionType ? type.elements.some( el=>hasVoidType(el.type()) ) : false;
                    }
                    if( !hasVoidType(acceptType) ){
                        if( this.async ){
                            const promiseType = this.getGlobalTypeById("Promise");
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