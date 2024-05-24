const Namespace = require("../core/Namespace");
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
        this._whenIsNullSetValue = null;
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
        }else if( this.parentStack.isAnnotationDeclaration ){
            const identifier = this.value();
            const name = this.parentStack.name.toLowerCase();
            const expre = `(local ${name}) ${identifier}:any`;
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
            return this.getRelateParamDescription( stack.parentStack, stack, index, propertyStack.concat(argument));
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
            if(argument.isArrayExpression || argument.isObjectExpression){
                let type = declareParam.type();
                if(type.isTupleType && type.rest){
                    type = type.elements[0].type()
                }
                while(type.isAliasType){
                    type = type.inherit.type();
                }
                let desc = type
                while(desc && propertyStack.length>0){
                    desc = fetchObjectType(desc, propertyStack.pop())
                }
                return desc; 
            }
            return declareParam;
        }

        const getDescription = (declareParams, pos)=>{
            if( declareParams && declareParams.length > 0 ) {
                if( pos >=0 && pos < declareParams.length ){
                    return fetchType(declareParams[pos]);
                }
            }
        }

        if(stack.isVariableDeclarator){
            const acceptType = stack.type();
            if(!acceptType)return []
            return [
                fetchType(acceptType),
                stack
            ];
        }

        if(stack.isAssignmentExpression){
            return [
                fetchType(stack.left.type()),
                stack
            ];
        }
    
        if( !(stack.isCallExpression || stack.isNewExpression) ){
            return null
        }

        let declareParams = stack.getFunDeclareParams();
        return [
            getDescription(declareParams, stack.arguments.indexOf(argument)),
            stack
        ];
    }

    getRelateParamType(){
        return this.getAttribute('Declarator.getRelateParamType',()=>{
            if( !this.parentStack.isFunctionExpression ){
                return null;
            }

            const stack = this.parentStack.parentStack;
            if(stack.isVariableDeclarator && stack.init ===this.parentStack){
                return null;
            }

            const index = this.parentStack.params.indexOf( this );
            if( !(index >=0) ) return null;
            
            const [declaredParam, _stack] = this.getRelateParamDescription(stack, this.parentStack, index) || [];
            if(!declaredParam || this === declaredParam)return null;
            this.setAttribute('Declarator.getRelateParamDescription', declaredParam);

            // const ctx = _stack.getContext();
            // this.setAttribute('Declarator.getRelateParamDescriptionCtx', ctx);

            let assigmentGenerics = null;
            let declareGenerics = null;
            if( _stack.isCallExpression || _stack.isNewExpression){
                assigmentGenerics = _stack.getAssigmentGenerics();
                if(assigmentGenerics && assigmentGenerics.length>0){
                    declareGenerics = _stack.getCalleeDeclareGenerics();
                }
            }

            const getType = (type)=>{
                const result = Utils.extractFunTypeFromType(type);
                if( !result )return null;
                const [declareFunction, _ctx, _assigmentGenerics, _declareGenerics] = result;
                let value = null;

                let assigGenerics = null;
                let declGenerics = null;
                if(_stack.isCallExpression || _stack.isNewExpression){
                    assigGenerics = assigmentGenerics;
                    declGenerics = declareGenerics;
                }else{
                    assigGenerics = _assigmentGenerics;
                    if(assigGenerics && _declareGenerics && _declareGenerics.length>0){
                        declGenerics = _declareGenerics.map(decl=>decl.type())
                    }
                }

                if( declareFunction.isFunctionType && declareFunction.params && declareFunction.params.length >0){

                    if(declareFunction.target && declareFunction.target===this.parentStack){
                        return null;
                    }

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

                if(value && value.isGenericType && assigGenerics && declGenerics){
                    const at = declGenerics.findIndex( decl=>{
                        if(decl===value)return true;
                        if(decl.assignType === value)return true;
                        return false;
                    });
                    if(at>=0 && assigGenerics[at]){
                        return assigGenerics[at].type();
                    }
                }

                return value;
            }

            const items = [];
            const paramType = declaredParam.type();
            if( paramType.isUnionType ){
                items.push( ...paramType.elements );
            }else if(paramType.isIntersectionType){
                items.push( paramType.left );
                items.push( paramType.right );
            }else{
                return getType(paramType);
            }
            for(let item of items){
                const result = getType(item.type());
                if(result)return result;
            }
            return null;
        });
    }

    getAssignType(){
        return this.getAttribute('getAssignType',()=>{
            let acceptType = this.acceptType;
            if( acceptType ){
                acceptType = acceptType.type();
            }else if( this.inheritInterfaceAcceptType ){
                acceptType = this.inheritInterfaceAcceptType.type();
            }
            if(!acceptType){
                acceptType = this.getRelateParamType();
            }
            return acceptType
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
            return Namespace.globals.get('Error');
        }

        let init = this.getDefaultInit();
        if( init && !this.checkNullType(init) ){
            const isSelf = init.isStack && init.description() === this;
            if( !isSelf ){
                return init.type();
            }
        }
        return Namespace.globals.get('any');
    }

    getDefaultInit(flag){
        let init = this._whenIsNullSetValue;
        if(init)return init;
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
        return this.getAttribute('Declarator.getContext',()=>{
            let ctx = null
            if( this.parentStack.isFunctionExpression){
                let stack = this.parentStack.parentStack;
                while( stack && (stack.isProperty || stack.isObjectExpression || stack.isArrayExpression)){
                    stack = stack.parentStack;
                }
                if( stack && (stack.isCallExpression  || stack.isNewExpression) ){
                   ctx = stack.getContext()
                }
            }
            if(!ctx && !this.isAssignmentPattern){
                const init = this.getDefaultInit(true)
                if(init && init instanceof Stack && init !== this){
                    if( !(init.isFunctionExpression || init.isArrayExpression || init.isObjectExpression) ){
                        ctx = init.getContext();
                    }
                }
            }
            const context = super.getContext();
            if(ctx){
                context.mergeAll(ctx)
            }
            context.make(this.getAssignType());
            return context;
        });
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
            if(type && (type.isNullableType || type.isUndefinedType)){
                if(type.isUndefinedType){
                    this.assignFirstValue = null;
                }
                return true;
            }
        }
        return false;
    }

    whenIsNullSetValue(value){
        const type = this.type();
        if(type && value){
            if(type.isNullableType || type.isUndefinedType){
                this._whenIsNullSetValue = value;
            }else if(type.isUnionType){
                const hasNull = type.elements.some( el=>{
                    const type = el.type();
                    return type.isNullableType || type.isUndefinedType
                });
                if(hasNull){
                    this._whenIsNullSetValue = value;
                }
            }
        }
    }

    assignment( value, stack=null ){
        if( this.assignValue !== value && value ){

            if( this.checkNullType(value) )return;

            let assignDesc = null;
            if( value && value.isStack ){
                assignDesc = value.descriptor();
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