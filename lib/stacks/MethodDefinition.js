const Stack = require("../core/Stack");
const Constant = require("../core/Constant");
const InstanceofType = require("../types/InstanceofType");
const Utils = require("../core/Utils");
const Namespace = require("../core/Namespace");
class MethodDefinition extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isMethodDefinition= true;
        this._metatypes = [];
        this._annotations = [];
        this.isMethod=true;
        this.static  = this.createTokenStack(compilation,node.static,scope,node,this);
        this.key     = this.createTokenStack(compilation,node.key,scope,node,this);
        let name = this.key.value();
        this.dynamicMethod = false;
        if( node.dynamic ){
            this.dynamicMethod = true;
            if(node.key.acceptType){
                this.dynamicType = this.createTokenStack(compilation,node.key.acceptType,scope,node,this);
            }else{
                name = this.key.raw();
            }
        }
        
        if( name ==="constructor" || name === this.module.id ){
            this.isConstructor = true;
            this.callable = false;
            if( node.genericity ){
                this.key.error(1062);
            }
        }else{
            this.callable = true;
        }
        this.expression = this.createTokenStack(compilation,node.value,scope,node,this);
        this.modifier= this.createTokenStack(compilation,node.modifier,scope,node,this);
        this.override = false;
        this.isFinal = false;
        this.isRemoved = false;
        this.isDeprecated = false;
        this.isNoop = false;
        this.expression.key = this.key;
        this.scope = this.expression.scope;
        this.kind = node.kind;
        if( !this.static ){
            this.expression.scope.define("this", new InstanceofType(this.module,this,null,true) );
        }else{
            this.scope.isStatic = true;
        }
        if( !this.parentStack.isUseExtendStatement ){
            if(!this.dynamicType){
                this.module.addMember(name, this);
            }
        }
        this.isEnterMethod = false;
        this.policy = Constant.POLICY_NONE;
    }

    freeze(){
        this.key.freeze();
        super.freeze();
        super.freeze( this.scope );
        super.freeze( this.static );
        super.freeze( this._metatypes );
        super.freeze( this._annotations );
        super.freeze( this.modifier );
        super.freeze( this.override );
        super.freeze( this._annotations );
        super.freeze( this.useRefItems );
        this.expression.freeze();
    }
    
    definition(ctx){

        let type = this.getReturnedType();
        if(Utils.isContext(ctx) && ctx.stack && ctx.stack.isCallExpression){
            type = ctx.apply(type);
        }

        let complete  = false;
        if( !ctx || (ctx.stack && (ctx.stack === this.key || ctx.stack === this || ctx.stack.isMemberExpression))){
            complete = true;
            ctx = {}
        }
        
        const identifier = this.value();
        const context = this;
        const _thisCtx = this.thisArgumentContext;
        const _params = _thisCtx ? [_thisCtx, ...this.params] : this.params;
        const params  = _params.map( item=>{
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
                    const acceptType = property.type().toString(ctx)
                    if( property.isAssignmentPattern ){
                        return `${property.left.value()}:${acceptType} = ${property.right.raw()}`;
                    }
                    const name = property.value();
                    return `${name}:${acceptType}`;
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
                return `${rest}${name}${question}: ${type}`
            }
        });

        const modifier = this.modifier ? this.modifier.value() : "public";
        const _static = this.static ? 'static ' : '';
        const generics = (this.genericity ? this.genericity.elements : []).map( item=>{
            return item.type().toString(ctx , {complete});
        });
        const kind = this.isConstructor ? 'constructor' : 'method';
        const strGenerics = generics.length > 0 ? `<${generics.join(", ")}>` : '';
        let owner = this.module.getName();
        
        if( !this.isConstructor ){
            if( this.dynamicMethod ){
                owner =`${owner}[${identifier}]`;
            }else{
                owner =`${owner}.${identifier}`;
            }
        }
        let location = this.key.getLocation();
        const returnType = type ? type.type().toString(ctx,{chain:['function']}) : this.isConstructor ? owner : 'void';
        return {
            comments:context.comments,
            expre:`(${kind}) ${_static}${modifier} ${owner}${strGenerics}(${params.join(", ")}): ${returnType}`,
            location:location,
            file:this.compilation.file,
        };
    }

    signature(){
        const def = this.definition()
        const _params = this.params;
        const comments = this.parseComments();
        const params  = _params.map( item=>{
            if( item.isObjectPattern ){
                return {
                    label:"ObjectPattern"
                }
            }else if(item.isArrayPattern){
                return {
                    label:"ArrayPattern"
                }
            }else{
                const name = item.value();
                const meta = comments && comments.params.find(param=>param.label===name);
                return {
                    label:name,
                    comment:meta && meta.comment ? meta.comment : item.comments.join("\n")
                }
            }
        })
        def.params = params;
        return def;
    }

    set metatypes(value){
        this._metatypes = value;
        if( this.isConstructor ){
            if( !this.callable ){
                this.callable = value.some( (metatype)=>{
                    metatype.additional = this;
                    return metatype.name.toLowerCase() === "callable";
                });
            }
            if( this.callable ){
                this.module.callable=this;
            }
        }
    }

    get metatypes(){
       return this._metatypes; 
    }

    set annotations(value){
        this._annotations = value;
        value.forEach( (annotation)=>{
            annotation.additional = this;
            switch( annotation.name.toLowerCase() ){
                case 'override' :
                    this.override = true;
                break;
                case 'callable' :
                    this.callable = !!this.isConstructor;
                    if(this.callable){
                        this.module.addDescriptor('#'+this.module.id, this)
                    }
                break;
                case 'main' :
                    this.isEnterMethod = true;
                break;
                case 'final' :
                    this.isFinal = true;
                break;
                case 'deprecated' :
                    this.isDeprecated = true;
                break;
                case 'removed' :
                    this.isRemoved = true;
                case 'noop' :
                    this.isNoop = true;
                break;
            }
        });
    }

    get annotations(){
        return this._annotations;
    }

    get params(){
        return this.expression.params;
    }

    get body(){
        return this.expression.body;
    }

    get genericity(){
        return this.expression.genericity;
    }

    get question(){
        return !!this.key.node.question;
    }

    get thisArgumentContext(){
        return this.expression.thisArgumentContext;
    }

    get hasRecursionReference(){
        return this.expression.hasRecursionReference
    }

    addRecursionCallStacks(stack){
        this.expression.addRecursionCallStacks(stack);
    }

    reference(called){
        return this.expression.reference( called );
    }
    referenceItems(called){
        return this.expression.referenceItems( called );
    }
    description(){
        return this;
    }
    error(code,...args){
        this.key.error(code,...args)
    }
    warn(code,...args){
        this.key.warn(code,...args)
    }

    getFunType(){
        return this.expression.getFunType();
    }

    inferReturnType(context){
        return this.expression.inferReturnType(context);
    }

    getReturnedType(caller){
        if( this.isConstructor ){
            return this.expression._returnType;
        }
        return this.expression.getReturnedType(caller);
    }

    getContext(){
        return this.expression.getContext();
    }

    type(){
        const expr = this.expression;
        const name = this.key.value();
        if( (name ==="constructor" || name === this.module.id) && !expr._returnType ){
            return this.module;
        }
        return expr.type();
    }

    get returnType(){
        const expr = this.expression;
        const name = this.key.value();
        if( (name ==="constructor" || name === this.module.id) && !expr._returnType ){
            return this.module;
        }
        return expr.returnType;
    }

    value(){
        if(this.dynamicMethod){
            return this.key.raw();
        }
        return this.key.value(); 
    }

    getAnnotationAlias(flag=true){
        const result = this.getAttribute('getAnnotationAlias',()=>{
            return this.findAnnotation(annot=>annot.getLowerCaseName() === 'alias' ? annot : false)
        })
        if(flag){
            if(result){
                const [annot] = result;
                if(annot && annot.isAnnotationDeclaration){
                    const args = annot.getArguments();
                    if(args[0]){
                        return args[0].value;
                    }
                }
            }
            return null;
        }
        return result
    }
    
    parser(){
        if(super.parser()===false)return false;
        if( this.dynamicType ){
            this.dynamicType.parser();
            this.module.dynamicProperties.set(this.dynamicType.type(), this);
        }else if(this.dynamicMethod){
            this.key.parser();
            this.module.dynamicProperties.set(this.key.type(), this);
        }

        if( this.parentStack.isUseExtendStatement ){
            this.expression.parser();
            return true;
        }

        const metatypes = this.metatypes;
        const annotations = this.annotations;
        if(metatypes){
            metatypes.forEach( item=> item.parser() )
        }

        if(annotations){
           annotations.forEach( item=> item.parser() )
        }

        if( this.module && !this.module.isDeclaratorModule ){

            const kind = this.isAccessor ? 'accessor' : 'method';
            const accessor = this.isMethodGetterDefinition ? 'get' : this.isMethodSetterDefinition ? 'set' : null;
            let parent = this.module.getInheritModule();
            if(this.module.isEnum && Namespace.globals.get('Enumeration') === parent){
                parent = null;
            }
        
            if( this.override ){
                if(this.static){
                    this.key.warn(1200)
                }else{
                    const pMethod = parent && parent.getMember( this.key.value() , accessor , true, false)
                    if( !parent || !pMethod ){
                        this.key.error(1063,this.key.value(),kind);
                    }else if( pMethod.isAccessor !== this.isAccessor ){
                        this.key.error(1136,this.key.value(),kind)
                    }
                    else if( this.params.length !== pMethod.params.length ){
                        if( this.isAccessor ){
                            this.key.error(1089,this.key.value() );
                        }else{
                            const isRest = this.params.length === 1 && this.params[0].isRestElement;
                            if( !isRest && pMethod.params.length >= this.params.length ){
                                if( !pMethod.params.every( (item,index)=>{
                                    if( item.question )return true;
                                    return !!this.params[index];
                                })){
                                    this.key.error(1088,this.key.value() );
                                }
                            }
                        }
                    }
                    if( pMethod && pMethod.isFinal ){
                        this.key.error(1148, this.key.value() )
                    }
                    if(pMethod){
                        this.params.forEach( (item,index)=>{
                            if(item.acceptType)return;
                            const right = pMethod.params[index];
                            if(right && right.acceptType){
                                item.inheritInterfaceAcceptType = right;
                            }
                        });
                    }
                }

            }else if(parent && !this.static){
                const parentMethod = parent.getMember( this.key.value(), accessor, true, false);
                if( parentMethod && Utils.getModifierValue(parentMethod) !== "private" ){
                    this.key.error(1064,this.key.value(),kind)
                }
            }
        }
        
        this.expression.parser();
        
    }
}

module.exports = MethodDefinition;