const Namespace = require("../core/Namespace.js");
const Type = require("./Type.js");
class FunctionType extends Type{
    constructor(inherit,target, params, returnType, generics){
        super("$FunctionType",[inherit]);
        this.params = params ? params : target.params || [];
        this._returnType = returnType;
        this.isFunctionType = true;
        this.target = target;
        this.generics = generics || (target.genericity && target.genericity.elements) || [];
        this.hasRestElement = false;
    }

    get returnType(){
        return this.inferReturnType();
    }

    get async(){
        return !!(this.target && this.target.async);
    }

    inferReturnType(){
        const r = this._returnType;
        if( !r && this.target && (this.target.isFunctionExpression || this.target.isTypeFunctionDefinition) ){
            return this.target.getReturnedType();
        }
        return r;
    }

    getInferReturnType(){
        const r = this._returnType;
        if( !r && this.target ){
            if(this.target.isFunctionExpression){
                return this.target.inferReturnType();
            }else{
                return this.target.getReturnedType();
            }
        }
        return r;
    }

    getReturnedType(){
        const r = this._returnType;
        if(!r && this.target){
            return this.target.getReturnedType();
        }
        return r;
    }

    type(context){
        if( context && context.called ){
            if( this.target && this.target.isFunctionExpression ){
                if( this._returnType ){
                    return context.apply( this._returnType );
                }else{
                    return this.target.type( context );
                }
            }
            return context.apply( this.returnType );
        }
        return this;
    }

    get hasGenericType(){
        return false;
    }

    checkHasGeneric(){
        if( this._hasGenericType === void 0){
            this._hasGenericType = this.params.concat( this.returnType , this.generics).some( item=>{
                const type = item && item.type();
                if( type ){
                    if( type.isFunctionType ){
                        return type.checkHasGeneric();
                    }
                    return !!type.hasGenericType;
                }
            });
        }
        return this._hasGenericType;
    }

    clone(inference){
        return this;
        // if( !inference  ){
        //     return this;
        // }
        // const params = this.params.map( item=>{
        //     return item.type().clone(inference);
        // });
        // let generics = []
        // let genericity = this.target && this.target.genericity;
        // if( genericity ){
        //     generics = genericity.elements.map( item=>item.type().clone(inference) );
        // }
        // let returnType = Utils.inferTypeValue(this.returnType, inference);
        // return new FunctionType(this.inherit,this.target,params,returnType, generics);
    }

    is(type, context,options={}){
        if( !type || !(type instanceof Type) )return false;
        type = this.inferType(type, context);
        type = this.getWrapAssignType(type);
        if( !this.isNeedCheckType(type) )return true;
        if( type.isUnionType ){
            return type.elements.every( item=>this.is(item.type(), context, options) );
        }
        if(Namespace.globals.get('Function')===type){
            return true;
        }

        if(type.isModule && type.id && typeof type.getDescriptor === 'function'){
            let hasMatch = false;
            type.getDescriptor(`#${type.id}`, (desc, prev)=>{
                if(desc.isCallDefinition){
                    if( this.is( desc.type() ) ){
                        return hasMatch = true;
                    }
                }
            });
            return hasMatch;
        }

        if( !type.isFunctionType )return false;
        const inWrapContext = type.target && type.target.parentStack && (type.target.parentStack.isProperty || type.target.parentStack.isCallExpression || type.target.parentStack.isNewExpression);
        if( type.params.length > 0 ){
            const params = this.params;
            const last = params && params[ params.length-1 ]; 
            const hasRest = this.hasRestElement || last && last.isRestElement;
            if( !hasRest && this.params.length < type.params.length){
                return false;
            }
            const result = type.hasRestElement ? true : type.params.every( (item,index)=>{
                if( inWrapContext && item.isStack && item.isDeclarator ){
                    if(!item.acceptType){
                        return true;
                    }
                }
                const acceptType = params[index];
                if( !acceptType || last===acceptType ){
                    if( hasRest ){
                        return last.getItemType().is(item.type(), context, options);
                    }
                }
                let itemType = item.isObjectPattern ? Namespace.globals.get('Object') : item.type();
                return acceptType && acceptType.type().is(itemType, context, options);
            });
            if( !result ){
                return false;
            }
        }
        if(inWrapContext && type.target.isStack && !type.target_returnType){
            return true;
        }
        let left = this.inferReturnType(context);
        let right= type.inferReturnType(context);
        let res = true;
        if( left ){
            res = right && left.type().is(right.type(), context, options);
        }
        return res;
    }

    definition(context){
        let location = null;
        let comments = '';
        if( this.target && (this.target.isFunctionExpression || this.target.isTypeFunctionDefinition) ){
            location = (this.target.key || this.target).getLocation();
            comments = this.target.comments || '';
        }
        let expre = this.toString(context);
        return {
            location,
            comments,
            expre:`(type) ${expre}`
        };
    }

    toString(context={}, options={}){
        options = Object.assign({},options)
        context = this.pushToStringChain(context, options);
        let complete = !!options.complete;
        let rawcode = options.rawcode;
        options.rawcode = false;

        if(options.complete === void 0 && !options.inferTypeValueFlag && !(context.stack && (context.stack.isCallExpression || context.stack.isNewExpression))){
            context = {};
            complete = true;
        }

        const params = this.target.params.map( (item,index)=>{
            if( item.isObjectPattern ){
                const properties = item.properties.map( property=>{
                    const name = property.key.value();
                    const acceptType = property.type();
                    const init = property.init;
                    if( init && init.isAssignmentPattern ){
                        return `${init.left.value()}:${acceptType.toString(context,options)} = ${init.right.raw()}`;
                    }
                    return `${name}:${acceptType.toString(context, options)}`;
                });
                return `{${properties.join(',')}}`;
            }else if( item.isArrayPattern ){
                const properties = item.elements.map( property=>{
                    if( property.isAssignmentPattern ){
                        const acceptType = property.type();
                        return `${property.left.value()}:${acceptType.toString(context,options)} = ${property.right.raw()}`;
                    }
                    const name = property.value();
                    const acceptType = property.type();
                    return `${name}:${acceptType.toString(context,options)}`;
                });
                return `[${properties.join(',')}]`;
            }else{
                const type = this.params[index].type();
                const name = item.value();
                const rest = item.isRestElement ? '...' : '';
                const question = item.question ? '?' : '';
                if( item.isAssignmentPattern && item.right ){
                    const initial = item.right.value();
                    return `${rest}${name}${question}: ${type.toString(context,options)}=${initial}`;
                }
                return `${rest}${name}${question}: ${type.toString(context,options)}`;
            }
        });
        const returnType = this.inferReturnType();
        const genOptions = Object.create(options);
        genOptions.complete = complete;
        genOptions.rawcode = rawcode;
        if(options.inbuild){
            genOptions.rawcode = true;
        }
        const genericity = this.generics.length > 0 ? '<'+( this.generics.map( item=>item.type().toString(context,genOptions) ) ).join(', ')+'>' : '';
        return `${genericity}(${params.join(", ")})=>${returnType.toString(context)}`;
    }
}
module.exports = FunctionType;