const Type = require("./Type");
class GenericType extends Type{
    constructor( target, inherit=null, assignType=null, isFunGeneric=false){
        super('$GenericType', inherit);
        this.target = target;
        this.isGenericType=true;
        this.assignType = assignType;
        this.isFunGeneric = isFunGeneric;
        this.hasGenericType = true;
        this.unikey = null;
    }

    getUniKey(){
        const unikey = this.unikey;
        if(unikey)return unikey;
        const target = this.target;
        const parent = target.parentStack.parentStack;
        const index = target.parentStack.elements.indexOf(target);
        const namespace = target.namespace.toString()
        let classId = null;
        let methodId = null;
        let hash = `${String(target.parentStack.elements.length)}`;
        if(parent.isClassDeclaration || parent.isInterfaceDeclaration || parent.isDeclaratorDeclaration){
            classId = parent.id.value();
        }else if( parent.isFunctionExpression ){
            if( parent.key ){
                hash+=`-${parent.params.length}`
                if( parent.parentStack.isMethodDefinition ){
                    classId = parent.parentStack.module.id;
                }else if(parent.module){
                    classId = parent.module.id
                }
                if(parent.isDeclaratorFunction){
                    classId = parent.key.value();
                }else{
                    methodId = parent.key.value();
                }
            }else if(parent.parentStack.isProperty ){
                const mStack = parent.parentStack.getParentStack((parent)=>{
                    if( parent.isMethodDefinition ){
                        return true;
                    }
                });
                if(parent.parentStack.module){
                    classId = parent.module.id
                }
                if( mStack && mStack.isMethodDefinition ){
                    methodId = `${mStack.key.value()}:${parent.parentStack.key.value()}`;
                }else{
                    methodId = parent.parentStack.key.value()
                }
            }
        }else if( parent.isDeclaratorTypeAlias ){
            classId = parent.id
        }
        const name = namespace ? `${namespace}.${classId}` : classId;
        const iden = methodId ? `${methodId}:${hash}-${index}` : `${hash}-${index}`;
        return this.unikey = `${name}::${iden}`;
    }

    get _extends(){
        const target = this.target;
        if(target){
            if(target.extends){
                return [ target.extends.type() ];
            }
        }
        return null;
    }

    set _extends(value){}

    get hasConstraint(){
        const target = this.target;
        if(target){
            return !!target.extends;
        }
        return false;
    }

    attribute( property ){
        const inherit = this.inherit;
        if( !inherit ){
            return null;
        }
        if( inherit.isLiteralObjectType ){
            return inherit.attribute( property );
        }else if( inherit.isModule ){
            return inherit.getMember(property,"get");
        }
        return null;
    }
    clone(inference){
        if(inference){
            const result = inference( this );
            if(result){
                return result
            }
        }
        return this;
    }
    check(stack, context={}, options={}){
        if(!stack)return false;
        const inference = context && context.inference;
        if( inference ){
            let target = inference(this);
            if( target !== this ){
                let inherit = this.inherit;
                if( inherit && inherit.type().isKeyofType ){
                   options.toLiteralValue = true;
                }
                return target.check(stack , context, options);
            }
        }
        return this.is(stack.type(), context, options);
    }
    is( type, context, options={}){
        if( !type || !(type instanceof Type) )return false;
        if( type.isUnionType ){
            return type.elements.every( item=>this.is( item.type(), context, options) );
        }
        if( !this.isNeedCheckType(type) )return true;
        let inherit = this.inherit;
        if( inherit && inherit.type().isKeyofType ){
           options.toLiteralValue = true;
        }

        let target = this.inferType(this,context)
        if( target !== this ){
            if(options.toLiteralValue){
                if( target.isLiteralArrayType || target.isTupleType){
                    return target.elements.some( base=>{
                        return base.type().is(type, context, options )
                    })
                }
            }
            return target.is(type , context, options);
        }
        
        if( type.isInstanceofType ){
            type = type.inherit;
        }

        if( inherit ){
            if( inherit && inherit.isLiteralObjectType){
                return inherit.constraint(type, context, options);
            }else{
                if( type.isGenericType && type.hasConstraint ){
                    type = type.inherit; 
                }
                return inherit.type().is(type, context, options);
            }
        }
        return false;
    }
    toString(context={}, options={}){
        let inherit = this.inherit;
        if( inherit && inherit.type().isKeyofType ){
            options.toLiteralValue = true;
        }
        let complete = options.complete;
        options.complete = false;
        if(!options.rawcode){
            if( options.onlyTypeName ){
                return this.target.value();
            }
            if(!complete){
                const type = this.inferType(this, context)
                if( type !== this ){
                    return type.toString(context, options);
                }
                if( options.toUniKeyValue ){
                    return this.getUniKey();
                }
                return this.target.value();
            }
        }

        const parts = [];
        parts.push( this.target.value() );

        if(inherit){
            parts.push(` extends ${inherit.toString(context, options)}`);
        }
        if(this.assignType){
            parts.push(' = '+this.assignType.toString(context, options) );
        }
        return parts.join('');
    }

}
module.exports = GenericType;