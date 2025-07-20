const Utils = require("../core/Utils");
const Namespace = require("../core/Namespace");
const Type = require("./Type");
class TupleType extends Type{
    constructor(inherit, elements , target, rest = false , isTupleUnion=false, prefix=false){
        super("$TupleType",inherit);
        this.elements = [].concat(elements);
        const len = this.elements.length;
        this.rest = rest;
        this.requireCount = rest && len > 1 ? len-1 : len;
        this.isTupleType = true;
        this.prefix = prefix ? true : !!(target && target.prefix);
        this.isTupleUnion = isTupleUnion ? true : !!(target && target.isTypeTupleUnionDefinition);
        this.target = target;
    }

    get hasGenericType(){
        return this.elements.some( type=>{
            type = type.type();
            return type && type.hasGenericType;
        });
    }

    getInferResult(context, records){
        let change = false;
        const elements = this.elements.map(el=>{
            const res = el.type().getInferResult(context, records);
            if(res)change=true;
            return res || el;
        })
        if(change){
            return new TupleType(this.inherit,elements,this.target,this.rest, this.isTupleUnion);
        }
        return null;
    }

    attribute(index){
        const elements = this.target && this.target.isArrayExpression ? this.target.elements : this.elements;
        if(!this.prefix){
            index = Number(index)
            if(!isNaN(index)){
                return elements[index] || null;
            }
        }
        return null;
    }

    dynamicAttribute( type, context=null ){
        const arrClass = Namespace.globals.get('Array');
        return arrClass && arrClass.dynamicProperties.get( Utils.getOriginType( type ) );
    }

    clone(inference, flag=false){
        if( !flag && (!inference || !this.hasGenericType) ){
            return this;
        }
        const elements = inference ? this.elements.map( item=>{
            return item.type().clone(inference);
        }) : this.elements.slice(0);
        return new TupleType(this.inherit,elements,this.target,this.rest, this.isTupleUnion);
    }
    checkItems(items, errorItems=[], context={}, options={}, typepPefix=false, originType=null){
        const errorHandler = context?.errorHandler || ( result=>result );
        const checkItem = (base, item, flag=true)=>{
            let baseType = base.type();
            if(!baseType)return false;
            let type = this.getWrapAssignType(item.type());
            if( baseType === type || this === type )return true;
            if( ( baseType.isThisType || (baseType.target && baseType.target.isThisType) ) && !type.isInstanceofType ){
                errorItems.push( [baseType, item] );
                if(options.forceResult)return true;
                return flag ? errorHandler(false, baseType, item) : false;
            }
            if( baseType && !baseType.is(type, context, options ) ){
                errorItems.push( [baseType, item] );
                if(options.forceResult)return true;
                return flag ? errorHandler(false, baseType, item) : false;
            }
            
            return true;
        }
        if(this.prefix || this.rest || this.isTupleUnion){
            return items.every( (item)=>{
                return errorHandler(this.elements.some( base=>{
                    return checkItem(base, item, false);
                }), this.elements, item);
            });
        }

        const elements = this.target && this.target.isArrayExpression ? this.target.elements : this.elements;
        const len = elements.length;
        const rest = len > 0 ? elements[ len-1 ] : null;
        const hasRest = rest && rest.type().rest;
        const requireCount = hasRest ? this.requireCount-1 : this.requireCount;
        if( (hasRest && items.length < requireCount) ){
            return false;
        }
        else if( !hasRest && items.length !== requireCount && !typepPefix){
            let result = this.prefix;
            items.slice(requireCount).forEach( item=>{
                result = errorHandler(false, null, item);
            });
            return result;
        }

        return items.every( (item,index)=>{
            let base = elements[index];
            if( base && !(hasRest && base === rest) ){
                return checkItem(base,item);
            }else{
                if( hasRest && rest ){
                    return checkItem(rest,item);
                }else{
                    return errorHandler(elements.some( (base)=>{
                        return checkItem(base,item, false);
                    }), elements, item );
                }
            }
        });
    }

    is( type, context={}, options={}){
        if( !type || !(type instanceof Type) )return false;
        type = this.inferType(type, context);
        type = this.getWrapAssignType(type);
        if(!this.isNeedCheckType(type))return true;
        if(type.isLiteralObjectType)return false;
        if( type.isAliasType ){
            return this.is(type.inherit.type(), context, options )
        }
        if( type.isUnionType ){
            return type.elements.every( item=>this.is(item.type(), context, options) );
        }else if(type.isIntersectionType){
            return [type.left,type.right].some( item=>this.is(item.type(), context, options) );
        }

        if( this.isTupleUnion && !this.inherit.is(type.inherit,context,options) ){
            return false;
        }

        let items = null;
        if(type.isClassGenericType && !type.isClassType){
            if(this.inherit.type().is(type.inherit.type(), context, options)){
                items = type.elements
            }else{
                return false;
            }
        }else if( type.isTupleType || type.isLiteralArrayType){
            if(type.isTupleType && type.target && type.target.isArrayExpression){
                items = type.target.elements;
                if(!items.length)return true;
            }else{
                items = type.elements;
            }
        }else if(this.rest){
            items = [type];
        }else{
            return false;
        }
        if(type.isLiteralArrayType && !items.length ){
            return true;
        }
        if(!this.elements.length){
            return true;
        }
        return this.checkItems( items , [], context, options, type.isTupleType && type.prefix, type);
    }

    needBrackets(){
        if( this.elements.length === 1 ){
            let first = this.elements[0] && this.elements[0].type();
            if(first){
                first = first.isComputeType && !first.object.isThisType ? first.getComputeType() : first;
                if( (first.isUnionType || first.isKeyofType) && first.elements.length > 1 ){
                    return true
                }else if( first.isFunctionType ){
                    return true;
                }
            }
        }
        return this.elements.length > 1;
    }

    toString(context={},options={}){
        options = Object.assign({},options)
        context = this.pushToStringChain(context, options);
        let isTupleUnion = this.isTupleUnion;
        let needBrackets = false;
        let hasAnyType = false;
        let elements = this.elements.map( (item)=>{
            let type = item && item.type();
            if(!type || type === this){
                hasAnyType = true;
                return 'any';
            }
            if(!needBrackets){
                if( type.isGenericType && typeof context.inference ==='function'){
                    const result = context.inference(type);
                    if(result && result.type().isUnionType){
                        needBrackets = result.type().elements.length > 1;
                    }
                }
            }
            return type.toString(context,options);
        });

        if((hasAnyType || options.hasAnyType) && this.prefix){
            elements=['any'];
        }

        const tupleRest = this.rest && this.target && this.target.isTypeTupleRestDefinition;
        const make = ()=>{
            if( isTupleUnion ){
                if( needBrackets || this.needBrackets() ){
                    return `(${elements.join(" | ")})[]`;
                }else{
                    return `${elements.join(" | ")}[]`;
                } 
            }
            let rest = tupleRest ? '...' : '';
            let squares = rest ? '' : '[]';
            if( elements.length === 1 && (this.prefix||this.rest) ){
                if( needBrackets || this.needBrackets() ){
                    return `${rest}(${elements[0]})${squares}`;
                }else{
                    return `${rest}${elements[0]}${squares}`;
                }
            }
            return `${rest}[${elements.join(',')}]`;
        }

        let result = make();
        if(options.showRestSymbol){
            if(this.rest && !result.startsWith('...')){
                result = '...'+result;
                if( !result.endsWith(']') ){
                    result += '[]';
                }
            }
        }
        return result;
    }
}
module.exports = TupleType;