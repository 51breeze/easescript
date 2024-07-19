const EventDispatcher = require('../core/EventDispatcher');
const Utils = require('../core/Utils');
class Type extends EventDispatcher{
    [Utils.IS_TYPE] = true;
    static is(value){
        return value ? value instanceof Type : false;
    }
    
    constructor( id , inherit){
        super();
        this._id = id;
        this._extends = null;
        this.extends= inherit;
        this.alias = null;
        this.isType = true;
        this.mtime = null;
    }
    set id(name){
        this._id = name;
    }
    get id(){
        return this._id;
    }
    set extends( _extends ){
        if( _extends ){
            if( _extends instanceof Array){
                if( _extends.length > 0 ){
                    this._extends=_extends;
                }
            }else if(_extends){
                this._extends=[_extends];
            }
        }
    }
    get extends(){
        return this._extends || [];
    }
    get inherit(){
        return this._extends ? this._extends[0] : null;
    }

    isSameSource( type ){
        if(!type)return false;
        const aCompilation = this.compilation || this.target && this.target.compilation;
        const bCompilation = type.compilation || type.target && type.target.compilation;
        return aCompilation === bCompilation && type.mtime === this.mtime;
    }

    clone(inference){
        if( this.isGenericType && inference){
            return inference(this);
        }
        return this;
    }
    definition(ctx){ 
        return {
            expre:`type ${this.toString(ctx)}`
        };
    }
    check(stack, context, options={}){
        return this.is( stack && stack.type(), context, options );
    }
    type( ctx ){
        return this;
    }
    isNeedCheckType(type){
        if( 
            type === this || 
            type.isNullableType ||
            type.isAnyType || 
            (this.target && type.target === this.target) 
        ){
            return false;
        }
        return true;
    }

    inferType(type, context){
        if( type && context && type.isGenericType){
            return context.isContext && context.apply ? context.apply(type) : type;
        }
        return type;
    }

    getModuleDeclareGenerics(flag=false, onlyread=false, origin=false){
        if(this.isAliasType ){
            const inherit = this.inherit.type();
            if( inherit.isAliasType && inherit.target.isDeclaratorTypeAlias && inherit.target.genericity){
                const declareGenerics = inherit.target.genericity.elements;
                if(origin){
                    return [inherit.target, declareGenerics]
                }
                if(flag){
                    return [inherit.target, declareGenerics.map(item=>item.type())];
                }
                if(onlyread){
                    return inherit.target.genericity;
                }
                return declareGenerics.map( item=>item.type() );
            }
        }
        return [];
    }

    getWrapAssignType(type){
        if(type && type.isTypeofType)type = type.origin;
        if(!type || !type.isClassGenericType)return type;
        const inherit = type.inherit.type();
        if( inherit.isAliasType && inherit.target.isDeclaratorTypeAlias && inherit.target.genericity){
            const declareGenerics = inherit.target.genericity.elements;
            if( declareGenerics && declareGenerics.length > 0 ){
                const target = inherit.inherit.type();
                if( type.elements.length === 1 ){
                    if( target === declareGenerics[0].type() ){
                        return this.getWrapAssignType(type.elements[0].type());
                    }
                }
                const ctx = inherit.target.newContext();
                declareGenerics.forEach( (decl, index)=>{
                    const value = type.elements[index];
                    if( value ){
                        ctx.extractive(decl.type(),this.getWrapAssignType(value.type()))
                    }
                });
                return ctx.apply(target);
            }
        }
        return type;
    }

    is( type, context, options={}){
        if( !type || !(type instanceof Type) )return false;
        if( this === type )return true;
        while( type && (type = type.inherit) ){
            if( this === type ){
                return true;
            }
        }
        return false;
    }
    pushToStringChain(context={},options={}){
        options.chain=(options.chain || []);
        if( options.chain.includes(this) ){
            options.onlyTypeName = true;
            options.hasExists = true;
            context = {};
        }else{
            options.chain.push(this);
        }
        return context;
    }
    toString(){
        return this._id;
    }
}
module.exports = Type;