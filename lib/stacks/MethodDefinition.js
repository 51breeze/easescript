const Stack = require("../core/Stack");
const Constant = require("../core/Constant");
const InstanceofType = require("../types/InstanceofType");
const keySymbol = Symbol("key");
class MethodDefinition extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isMethodDefinition= true;
        this._metatypes = [];
        this._annotations = [];
        this.isMethod=true;
        this.static  = this.createTokenStack(compilation,node.static,scope,node,this);
        this.key     = this.createTokenStack(compilation,node.key,scope,node,this);
        if( node.dynamic && node.key.acceptType ){
            this.dynamicType = this.createTokenStack(compilation,node.key.acceptType,scope,node,this);
        }
        const name = this.key.value();
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
        this.expression.key = this.key;
        this.scope = this.expression.scope;
        this.kind = node.kind;
        if( !this.static ){
            this.expression.scope.define("this", new InstanceofType(this.module,this,null,true) );
        }else{
            this.scope.isStatic = true;
        }
        if( !this.parentStack.isUseExtendStatement ){
            this.module.addMember(name, this);
        }
        this.isEnterMethod = false;
        this[keySymbol]={};
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

        const type = this.getReturnedType();
        let complete  = false;
        if( !ctx || (ctx.stack && (ctx.stack === this.key || ctx.stack === this || ctx.stack.isMemberExpression))){
            complete = true;
            ctx = {}
        }
        
        const identifier = this.key.value();
        const context = this;
       
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
        let owner = !_static || this.isConstructor ? this.module.toString(ctx) : this.module.getName();
        
        if( !this.isConstructor ){
            if( this.dynamicType ){
                owner =`${owner}[${identifier}:${this.dynamicType.type().toString(ctx)}]`;
            }else{
                owner =`${owner}.${identifier}`;
            }
        }
        
        var location = this.key.getLocation();
        if( this.isConstructor ){
            const classStack = this.module.moduleStack;
            if( classStack && classStack.id){
                location = classStack.id.getLocation();
            }
        }

        const returnType = type ? type.type().toString(ctx) : this.isConstructor ? owner : 'void';
        return {
            comments:context.comments,
            expre:`(${kind}) ${_static}${modifier} ${owner}${strGenerics}(${params.join(", ")}): ${returnType}`,
            location:location,
            file:this.compilation.file,
        };
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
                    if( this.callable )this.module.callable=this;
                break;
                case 'main' :
                    this.isEnterMethod = true;
                break;
                case 'final' :
                    this.isFinal = true;
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

    getReturnedType(context){
        if( this.isConstructor ){
            return this.expression._returnType;
        }
        return this.expression.getReturnedType(context);
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
        return this.key.value(); 
    }
    
    async parser(){
        return await this.callParser(async ()=>{

            // if( this.module && !this.module.isDeclaratorModule){
            //     console.log(this.file, '----parser before-----', this.value())
            // }

            if( this.dynamicType ){
                await this.dynamicType.parser();
            }

            if( this.parentStack.isUseExtendStatement ){
                await this.expression.parser();
                return true;
            }

            const metatypes = this.metatypes;
            const annotations = this.annotations;
            if(metatypes){
                await this.allSettled( metatypes, async item=>await item.parser() )
            }

            if(annotations){
                await this.allSettled( annotations, async item=>await item.parser() )
            }

            if( this.module && !this.module.isDeclaratorModule ){

                const kind = this.isAccessor ? 'accessor' : 'method';
                const accessor = this.isMethodGetterDefinition ? 'get' : this.isMethodSetterDefinition ? 'set' : null;
                const parent = this.module.extends[0];
            
                if( this.override ){
                    const pMethod = parent && parent.getMember( this.key.value() , accessor )
                    if( !parent || !pMethod ){
                        this.key.error(1063,this.key.value(),kind)
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

                }else if( parent ){
                    const parentMethod = parent.getMember( this.key.value(), accessor );
                    if( parentMethod && !(parentMethod.modifier && parentMethod.modifier.value()=="private") ){
                        this.key.error(1064,this.key.value(),kind)
                    }
                }
            }
            
            await this.expression.parser();

            // if( this.module && !this.module.isDeclaratorModule){
            //     console.log(this.file, '----parser done-----', this.value())
            // }

        });
        
    }
}

module.exports = MethodDefinition;