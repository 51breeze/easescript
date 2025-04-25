const MethodDefinition = require("./MethodDefinition");
class MethodSetterDefinition extends MethodDefinition{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isMethodSetterDefinition= true;
        this.callable = false;
        this.assignValue = null;
        this.assignItems= new Set();
        this.isAccessor = true;
    }
    freeze(){
        super.freeze();
        super.freeze( this.assignItems );
    }
    definition( ctx ){
        
        let complete  = false;
        if( !ctx || (ctx.stack && (ctx.stack === this.key || ctx.stack === this))){
            complete = true;
            ctx = {}
        }

        const identifier = this.key.value();
        const context = this;
        const params  = this.params.map( item=>{
            let type = item.type();
            type = type ? type.toString(ctx) : 'unknown';
            return `${item.value()}:${type}`;
        });
        const modifier = this.modifier ? this.modifier.value() : "public";
        let owner = this.module.getName();
        const _static = this.static ? 'static ' : '';
        const declareGenerics = this.module.getModuleGenerics();
        if( declareGenerics ){
            owner = [owner,'<',declareGenerics.map( type=>type.toString(ctx, {complete}) ).join(", "),'>'].join("")
        }
        return {
            comments:context.comments,
            expre:`(propery) ${_static}${modifier} set ${owner}.${identifier}(${params.join(",")}):void`,
            location:this.key.getLocation(),
            file:this.compilation.file,
        };
    }
    parser(){
        if(super.parser()===false)return false;
        if( this.expression.params.length != 1 ){
            this.error(1067,this.key.value());
        }
        const param = this.expression.params[0];
        if( param.acceptType ){
            let has = false;
            const type = param.acceptType.type();
            const ctx = this.getContext();
            const desc = this.module.getDescriptor(this.key.value(), (desc)=>{
                if( desc && desc.isMethodGetterDefinition ){
                    has = true;
                    return type && type.check(desc, ctx); 
                }
            });
            if( has ){
                if( !desc ){
                    this.error(1068,this.key.raw());
                }
            }
        }
    }

    type(){
        return this.getGlobalTypeById("void");
    }
    
    getFunType(){
        return null;
    }

    referenceItems(){
        return [];
    }

    reference(){
        return null;
    }

    assignment( value, stack=null ){
        if( this.assignValue !== value ){
            const param = this.expression.params[0];
            let acceptType = param.acceptType ? param.acceptType.type() : null;
            if( !acceptType ){
                const desc = this.compilation.getReference(this.key.value(), this.module, !!this.static , "get");
                acceptType = desc ? desc.type() : null;
            }
            const result = this.checkExpressionType( acceptType, value, stack || this );
            if( result ){
                this.assignItems.add( value );
                this.assignValue = value;
            }
            if( value && value.isStack ){
                this.setRefBeUsed( value.description() );
            }
        }
    }
}

module.exports = MethodSetterDefinition;