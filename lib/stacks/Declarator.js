const Stack = require("../core/Stack");
const Utils = require("../core/Utils");
class Declarator extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isDeclarator= true;
        if( !(parentStack && (parentStack.isArrayPattern || parentStack.isProperty && parentStack.parentStack.isObjectPattern ) ) ){
            this._acceptType = this.createTokenStack( compilation, node.acceptType, scope, node ,this);
        }
        let p = parentStack && parentStack.isProperty && parentStack.parentStack && parentStack.parentStack.isObjectPattern ? parentStack.parentStack : parentStack;
        p = p && (p.isArrayPattern || p.isObjectPattern) && p.parentStack ? p.parentStack : parentStack;
        if( p && (p.isFunctionExpression || p.isTypeFunctionDefinition || p.isTryStatement) ){
            this.question = !!node.question;
            this.isParamDeclarator = true;
        }
        this.assignValue = null;
        this.assignFirstValue = null;
        this.assignItems = new Set();
        this._kind = "var";
    }

    get acceptType(){
        const parent = this.parentStack;
        let _acceptType = this._acceptType;
        if( !_acceptType && parent ){
            if( parent.isArrayPattern ){
                if( parent.acceptType && parent.acceptType.isTypeTupleDefinition ){
                    const index = parent.elements.indexOf(this);
                    _acceptType = parent.acceptType.elements[index]||null;
                }
            }else if(parent.isProperty && parent.parentStack.isObjectPattern ){
                _acceptType = parent.acceptType;
            }
        }
        return _acceptType;
    }

    freeze( target ){
        super.freeze(target);
        super.freeze( this.assignItems );
        super.freeze( this.useRefItems );
        this.acceptType && this.acceptType.freeze();
    }

    definition(context){
        context = context || this.getContext();
        const type = this.type().toString( context );
        if( this.isParamDeclarator ){
            const identifier = this.value();
            let relate = this.getAttribute('Declarator.getRelateParamDescriptionParamItem');
            let comments = this.comments;
            let location = this.getLocation();
            let file = this.compilation.file;
            if(context.stack===this){
                if( relate && relate.isStack ){
                    comments = relate.comments;
                    location = relate.getLocation();
                    file = relate.compilation.file;
                }
            }
            return {
                comments,
                expre:`(parameter) ${identifier}:${type}`,
                location,
                file,
            };
        }else if(this.parentStack.isArrayPattern || this.parentStack.isProperty && this.parentStack.parentStack.isObjectPattern){
            const identifier = this.value();
            const expre = `(local ${this.kind}) ${identifier}:${type}`;
            return {
                comments:this.comments,
                expre:expre,
                location:this.getLocation(),
                file:this.compilation.file,
            };
        }
        return null;
    }

    set kind(value){
       this._kind=value;
    }

    get kind(){
        let p= this.parentStack;
        let flag = false
        if(p && p.isArrayPattern){
            flag = true
            p = p.parentStack
        }else if(p && p.isProperty && p.parentStack.isObjectPattern){
            flag = true
            p = p.parentStack.parentStack;
        }
        if(flag && p && p.isVariableDeclarator){
            return p.kind;
        }
        return this._kind;
    }

    reference( called ){
        if( Utils.isFunction(this.assignValue) ){
            return this.assignValue;
        }
        if( this.assignValue && this.assignValue.isStack){
            return this.assignValue.reference( called ) || this.assignValue;
        }
        return this;
    }

    referenceItems( called ){
        let items = [];
        this.assignItems.forEach( item=>{
            if( !called && Utils.isFunction(item) ){
                items.push(item)
            }else{
                items=items.concat( item.referenceItems( called ) || item );
            }
        });
        return items.length > 0 ? items : [this];
    }

    description(){
        return this;
    }

    getRelateParamDescription(stack, argument, index, propertyStack=[]){

        if( !stack )return null;
        if( stack.isObjectExpression ){
            return this.getRelateParamDescription( stack.parentStack, stack, index, propertyStack.concat(argument));
        }else if( stack.isProperty ){
            return this.getRelateParamDescription( stack.parentStack, stack, index, propertyStack);
        }else if( stack.isArrayExpression ){
            return this.getRelateParamDescription( stack.parentStack, stack, index, propertyStack);
        }

        const getDescription = (declareParams, pos, ctx, desc)=>{
            if( declareParams && declareParams.length > 0 ) {
                if( pos >=0 && pos < declareParams.length ){
                    let declareParam = declareParams[pos];
                    if( argument.isObjectExpression ){
                        if( Array.isArray(propertyStack) ){
                            desc = declareParam.type();
                            while(desc && propertyStack.length>0){
                                desc = ctx.getObjectDescriptorForAuxiliary(desc, propertyStack.pop().value() );
                                if( desc && propertyStack.length > 0 ){
                                    desc = desc.type();
                                }
                            }
                            return desc;
                        }
                    }else{
                        return declareParam;
                    }
                }
            }
        }

        if(stack.isAssignmentExpression){
            let type = stack.left.type();
            while( type && type.isAliasType ){
                type = type.inherit.type();
            }
            return type && type.isFunctionType ? [
                getDescription(type.params, index, stack.left, stack.left.description()),
                stack.left
            ] : null;
        }
    
        if( !(stack.isCallExpression || stack.isNewExpression) ){
            return null
        }

        let desc = stack.description();
        let funType = stack.isCallExpression ? stack.getDeclareFunctionType(desc) : desc;
        let declareParams = stack.getFunDeclareParams(funType);
        return [
            getDescription(declareParams, stack.arguments.indexOf(argument), stack, desc),
            stack
        ];
    }

    getRelateParamType(){
        return this.getAttribute('Declarator.getRelateParamType',()=>{
            if( !this.parentStack.isFunctionExpression ){
                return null;
            }
            const index = this.parentStack.params.indexOf( this );
            if( !(index >=0) ) return null;
            const stack = this.parentStack.parentStack;
            const [description, _stack] = this.getRelateParamDescription(stack, this.parentStack, index) || [];
            if( !description || this === description )return null;
            this.setAttribute('Declarator.getRelateParamDescription', description);
            const ctx = _stack.getContext();
            const getType = (type)=>{
                const result = Utils.extractFunTypeFromType(type);
                if( !result )return null;
                const [declareFunction, ctx] = result;
                let value = null;
                if( declareFunction.isFunctionType && declareFunction.params && declareFunction.params.length >0){
                    const param = declareFunction.params[ index ];
                    if( param ){
                        this.setAttribute('Declarator.getRelateParamDescriptionParamItem', param);
                        if( param.isRestElement ){
                            value = param.getItemType();
                        }else{
                            value = param.type();
                        }
                    }else{
                        const restMaybe = declareFunction.params[ declareFunction.params.length-1 ];
                        if( restMaybe && restMaybe.isRestElement ){
                            this.setAttribute('Declarator.getRelateParamDescriptionParamItem', restMaybe);
                            value = restMaybe.getItemType();
                        }
                    }
                }
                if(value && ctx){
                    return ctx.apply(value);
                }
                return value;
            }
            const items = [];
            const paramType = description.type();
            if( paramType.isUnionType ){
                items.push( ...paramType.elements );
            }else if(paramType.isIntersectionType){
                items.push( paramType.left );
                items.push( paramType.right );
            }else{
                return ctx.apply(getType(paramType));
            }
            for(let item of items){
                const result = getType(item.type());
                if(result)return ctx.apply(result);
            }
            return null;
        });
    }

    getAssignType(){
        return this.getAttribute('Declarator.getAssignType',()=>{
            let acceptType = this.acceptType;
            if( acceptType ){
                acceptType = acceptType.type();
            }else if( this.inheritInterfaceAcceptType ){
                acceptType = this.inheritInterfaceAcceptType.type();
            }else{
                const result = this.getRelateParamType();
                if( result ){
                    acceptType = result;
                }
            }
            return acceptType;
        });
    }
    
    type(){
        let acceptType = this.getAssignType();
        if( acceptType ){
            return acceptType;
        }

        if( this.parentStack.isProperty && this.parentStack.parentStack.isObjectPattern ){
            return this.parentStack.type();
        }

        if( this.parentStack.isTryStatement ){
            return this.getGlobalTypeById('Error');
        }

        let init = this.getDefaultInit();
        if( init && !this.checkNullType(init) ){
            //const isSelf = init.isStack && init.parentStack && init.parentStack.isAssignmentExpression && init.parentStack.description() === this;
            const isSelf = init.isStack && init.description() === this;
            if( !isSelf ){
                return init.type();
            }
        }

        return this.getGlobalTypeById("any");
    }

    getDefaultInit(flag){
        let init = null;
        if( this.parentStack.isArrayPattern && this.parentStack.parentStack.isVariableDeclarator ){
            if(this.isAssignmentPattern){
                init = this.right;
            }else{
                // const decle = this.parentStack.parentStack.init;
                // if( decle ){
                //     const index = this.parentStack.elements.indexOf( this );
                //     if( index >= 0 ){
                //         const arr = decle.type();
                //         if( arr && (arr.isLiteralArrayType || arr.isTupleType) && arr.elements.length > index ){
                //             init = arr.elements[index];
                //         }
                //     }
                // }
            }
        }
        else if(this.isVariableDeclarator){
            init = this.init;
        }else if(this.isAssignmentPattern){
            init = this.right;
        }else if(this.dynamic && this.parentStack.isPropertyDefinition && this.init && this.init.isTypeDefinition){
            init = this.init;
        }
        if(flag)return init;
        return init || this.assignFirstValue;
    }

    getContext(){
        let acceptType = this.getAssignType();
        if(acceptType){
            if( this.parentStack.isFunctionExpression){
                let stack = this.parentStack.parentStack;
                while( stack && (stack.isProperty || stack.isObjectExpression || stack.isArrayExpression)){
                    stack = stack.parentStack;
                }
                if( stack && (stack.isCallExpression  || stack.isNewExpression) ){
                    return this.getAttribute('Declarator.getContext',()=>{
                        return stack.getContext().createChild(this);
                    });
                }
            }
            const ctx = super.getContext();
            ctx.make(acceptType);
            return ctx;
        }else{
            const init = this.getDefaultInit(true)
            if(init && init instanceof Stack){
                return init.getContext();
            }
            return super.getContext();
        }
    }

    parser(){
        if(super.parser()===false)return false;
        if(this.acceptType){
            this.acceptType.parser();
            const type = this.acceptType.type();
            const origin = Utils.getOriginType( type );
            const module = this.module;
            const isGlobal = module && module.compilation.pluginScopes.scope==='global';
            if( origin && origin.isModule && Utils.isTypeModule(origin) && origin.compilation.pluginScopes.scope !== 'global' && !isGlobal){
                this.compilation.addDependency(origin, this.module);
            }
        }
        if( this.module && this.module.id === this.value() ){
            this.error(1008,this.value());
        }
    }

    checkNullType(type){
        if( type ){
            type = type.type();
            if(type && type.isNullableType){
                return true;
            }
        }
        return false;
    }

    assignment( value, stack=null ){
        if( this.assignValue !== value && value ){

            if( this.checkNullType(value) )return;

            let assignDesc = null;
            if( value && value.isStack ){
                assignDesc = value.description();
            }

            if( assignDesc ){
                if( assignDesc === this || (assignDesc.isStack && assignDesc.description() === this) ){
                    //this.setRefBeUsed( assignDesc );
                    return;
                }
            }

            let acceptType = this.acceptType || this.inheritInterfaceAcceptType;
            let isNullable = false;
            if( !acceptType ){
                let init = this.getDefaultInit();
                if( init ){
                    isNullable = this.checkNullType( init );
                    if( !isNullable ){
                        acceptType = init.type();
                    }
                }
            }

            if( acceptType ){
                const errorStack = stack && stack.isStack ? stack : null;
                if( this.checkExpressionType( acceptType , value, errorStack ) ){
                    this.assignItems.add( value );
                    this.assignValue = value;
                }
            }

            if( !this.assignFirstValue && !this.checkNullType(value) ){
                this.assignFirstValue = value;
            }
        }
    }
}

module.exports = Declarator;