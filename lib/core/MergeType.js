const LiteralObjectType = require("../types/LiteralObjectType");
const TupleType = require("../types/TupleType");
const UnionType = require("../types/UnionType");
const Namespace = require("./Namespace");
const Utils = require("./Utils");
const LiteralType = require("../types/LiteralType");
class MergeType{

    static is(type){
        return Utils.isMergedType(type);
    }

    constructor(originType){
        this.originType = originType;
        this.dynamicProperties = null;
        this.types = new Map();
        this.question = {};
        this.target = null;
        this.dataGroup = null;
        this.hasTuplePrefix = false;
        this.isTupleType = false;
        this.isTupleUnion = true;
        this.keepOriginRefs = false;
        this.classGenericOriginType = null;
        this.isClassGenericType = false;
    }

    createGroup(stack){
        const type = stack.type();
        const dataGroup = this.dataGroup || (this.dataGroup = new Map());
        const originType = Utils.getOriginType(type);
        let dataset = dataGroup.get(originType);
        if( !dataset){
            dataGroup.set(originType, dataset = new MergeType( originType ) );
            dataset.keepOriginRefs = this.keepOriginRefs;
            dataset.target = type.target;
        }
        if( type.isLiteralObjectType ){
            dataset.dynamicProperties = type.dynamicProperties;
            let has = dataset.types.size > 0;
            if( has ){
                dataset.types.forEach( (value,prop)=>{
                    if( !type.properties.has(prop) ){
                        dataset.question[prop] = true;
                    }
                });
            }
            type.properties.forEach( (value,prop)=>{
                let items = dataset.types.get(prop)
                if( !items ){
                    dataset.types.set(prop, items=new MergeType() );
                    items.keepOriginRefs = this.keepOriginRefs;
                    if( has ){
                        dataset.question[prop] = true;
                    }
                }
                if( type.questionProperties && type.questionProperties[prop] ){
                    dataset.question[prop] = true;
                }
                items.add( value );
            });
           
        }else if(type.isLiteralArrayType || type.isTupleType){
            dataset.hasTuplePrefix = !!type.prefix;
            dataset.isTupleType = !!type.isTupleType;
            dataset.isTupleUnion = this.forceNotTupleUnion ? false : MergeType.isTupleUnion( type );
            type.elements.forEach( (item,index)=>{
                dataset.add( item );
            });
        }
        return dataset;
    }


    add( stack , toLiteralValue=false, eliminateNullable=false){
        let type = stack && stack.type();
        if(type){
            if(eliminateNullable && (type.isNullableType || type.isUndefinedType)){
                return;
            }
            if( type.isLiteralValueType ){
                this.types.set(type.value,  type);
            }
            else if( toLiteralValue && type.isLiteralType ){
                if(!type.isLiteralValueType){
                   type = new LiteralType(type.inherit, type.target, type.value, type.compareLiteralValue);
                   type.setValueToShow();
                }
                this.types.set(type.toString(), type);
            }
            else if( type.isLiteralArrayType || type.isTupleType ){
                const originType = Utils.getOriginType(type);
                this.types.set(originType, this.createGroup(stack) );
            }else if( type.isLiteralObjectType ){
                if( !this.keepOriginRefs ){
                    const originType = Utils.getOriginType(type);
                    this.types.set(originType, this.createGroup(stack) );
                }else{
                    this.types.set(type.toString({}, {toUniKeyValue:true}), stack);
                }

            }else if( type.isUnionType ){
                type.elements.forEach( item=>{
                    const type = item.type();
                    if(eliminateNullable && type && (type.isNullableType || type.isUndefinedType)){
                        return;
                    }
                    const key = type.toString();
                    if( !this.types.has(key) ){
                        if( !this.keepOriginRefs ){
                            this.types.set(key, type);
                        }else{
                            this.types.set(key, item);
                        }
                    }
                });
            }
            else if( type.isClassGenericType ){
                const key = type.inherit.type();
                let group = this.types.get(key);
                if( !group ){
                    group = new MergeType();
                    group.classGenericOriginType = key;
                    group.isClassGenericType = type.isClassType;
                    group.target = type.target;
                    this.types.set(key,group);
                }
                type.types.forEach( (item,index)=>{
                    index = String(index);
                    let merge = group.types.get(index);
                    if( !merge ){
                        merge = new MergeType();
                        group.types.set(index, merge);
                    }
                    merge.add(item);
                });  
            }
            else if( type.isModule && type.isType ){
                this.types.set(type, type);
            }else if( type.isInstanceofType){
                this.types.set(type.inherit, type);
            }else if( type.isGenericType ){
                this.types.set(type, stack);
            }else{
                let key = type.toString();
                if( !this.types.has(key) ){
                    if( !this.keepOriginRefs ){
                        this.types.set(key, type);
                    }else{
                        this.types.set(key, stack);
                    }
                }
            }
        }
    }

    type(){
        const origArrayType = Namespace.globals.get('Array');
        const origObjectType = Namespace.globals.get('Object');
        if( this.originType === origArrayType ){
            const elements = [];
            this.types.forEach( (type)=>{
                if( type instanceof MergeType ){
                    elements.push( type.type() );
                }else{
                    elements.push( type );
                }
            });
            if(!elements.length){
                elements.push( Namespace.globals.get('any') );
            }
            return Utils.setMergedType(new TupleType(origArrayType, elements, this.target, false, this.isTupleUnion, !!this.hasTuplePrefix));
        }else if( this.originType === origObjectType ){
            const properties = new Map();
            this.types.forEach( (property,propName)=>{
                if( property instanceof MergeType ){
                    properties.set(propName, property.type() );
                }else{
                    properties.set(propName, property);
                }
            });
            return Utils.setMergedType(new LiteralObjectType(origObjectType, this.target, properties, this.dynamicProperties, this.question ));
        }

        let items = Array.from( this.types.values() ).map(item=>item.type() )
        if( this.classGenericOriginType ){
            const ClassGenericeType = require("../types/ClassGenericType");
            return Utils.setMergedType(new ClassGenericeType(items, this.classGenericOriginType, this.isClassGenericType, this.target));
        }
        if( !(items.length>0) || items.some( type=>{
            type = type.type();
            return type.isAnyType && !type.isUnknownType && !type.isComputeType;
        })){
            return Namespace.globals.get('any');
        }

        if( items.length > 1 ){
            let i = 0;
            let first = null;
            while( i<items.length && items.length > 1){
                const item = items[i];
                if( item.isLiteralObjectType ){
                    if( first === null ){
                        first = !this.keepOriginRefs ? item.clone(null, true) : item;
                        i++;
                    }else{
                        const dynamics = item.dynamicProperties;
                        if( dynamics ){
                            if(!first.dynamicProperties){
                                first.dynamicProperties = dynamics;
                            }else{    
                                dynamics.forEach( (item,key)=>{
                                    if(!first.dynamicProperties.has(key)){
                                        first.dynamicProperties.set(key, item);
                                    }
                                });
                            }
                        }
                        if( !(item.properties.size > 0) ){
                            items.splice(i,1);
                        }else{
                            i++;
                        }
                    }
                }else{
                    i++;
                }
            }
        }

        if( items.length > 1  ){

            const dataset = new Map();
            const numberTypes = ['int', 'uint', 'float','double','number'];
            items.forEach( item=>{
                if(Utils.isGlobalShortenType(item)){
                    let name = item.toString();
                    if(numberTypes.includes(name)){
                        if(name==='number'){
                            numberTypes.forEach(key=>{
                                dataset.delete(key);
                            });
                            dataset.set(name, item);
                        }else if(!dataset.has('number')){
                            if(name==='unit'){
                                if(!dataset.has('int')){
                                    dataset.set(name, item)
                                }
                            }else if(name==='double'){
                                if(!dataset.has('float')){
                                    dataset.set(name, item)
                                }
                            }else{
                                dataset.set(name, item)
                                if(name==='float'){
                                    dataset.delete('double');
                                }else if(name==='int'){
                                    dataset.delete('unit');
                                }
                            }
                        }
                    }else{
                        dataset.set(name, item)
                    }
                }else{
                    dataset.set(item, item)
                }
            });

            items = Array.from(dataset.values());
            if(items.length>1){
                return Utils.setMergedType(new UnionType(items, this.target));
            }
        }
        return items[0];
    }

    static forOfItem(type, keepOriginRefs=true){
        if( !type )return type;
        const origin = type;
        while(type && type.isAliasType){
            type = type.inherit.type();
        }
        if(!type)return origin;
        if( type.isLiteralArrayType || type.isTupleType || type.isLiteralObjectType || type.isClassGenericType){
            var mergeType = new MergeType();
            mergeType.keepOriginRefs = keepOriginRefs;
            if( type.isClassGenericType ){
                type.types.forEach( item=>{
                    mergeType.types.set( item.type(), item.type() );
                });
            }
            else if( type.isLiteralArrayType || type.isTupleType ){
                type.elements.forEach( item=>{
                    mergeType.add( item.type() );
                });
            }else {
                type.properties.forEach( item=>{
                    mergeType.add( item.type() );
                });
            }
            return mergeType.type();
        }
        return origin;
    }

    static isTupleUnion(type){
        if( type && type.isTupleType && type.target && type.target.isTypeTupleDefinition && !type.prefix && !type.isTupleUnion ){
            return false;
        }
        return true
    }

    static isNeedMergeType(type){
        if( type && type.isTupleType && type.target && type.target.isTypeTupleDefinition && !type.prefix && !type.isTupleUnion ){
            return false;
        }
        return true;
    }

    static to( stack, arrayToUnion=false, keepOriginRefs= false, toLiteralValue=false ){
        const type = stack && stack.type();
        if( type ){
            if( type.isLiteralArrayType || type.isTupleType ){
                const origArrayType = Namespace.globals.get('Array');
                var mergeType = new MergeType( arrayToUnion ? null : origArrayType );
                mergeType.keepOriginRefs = keepOriginRefs;
                mergeType.hasTuplePrefix = !!type.prefix;
                mergeType.isTupleType = !!type.isTupleType;
                mergeType.isTupleUnion = MergeType.isTupleUnion( type );
                mergeType.target = type.target;
                type.elements.forEach( item=>{
                    mergeType.add( item , toLiteralValue);
                });
                return mergeType.type();
            }else if( type.isLiteralObjectType ){
                if( keepOriginRefs ){
                    return stack;
                }
                const origObjectType = Namespace.globals.get('Object');
                var mergeType = new MergeType( arrayToUnion ? null : origObjectType );
                mergeType.keepOriginRefs = keepOriginRefs;
                mergeType.dynamicProperties = type.dynamicProperties;
                mergeType.target = type.target;
                type.properties.forEach( (value,prop)=>{
                    mergeType.types.set( prop, MergeType.to( value, false, keepOriginRefs ) )
                });
                return mergeType.type();
            }else if( type.isUnionType ){
                var mergeType = new MergeType();
                mergeType.keepOriginRefs = keepOriginRefs;
                mergeType.target = type.target;
                type.elements.forEach( item=>{
                    mergeType.add( item );
                });
                return mergeType.type();  
            }
            else{
                if(keepOriginRefs){
                    return stack;
                }else{
                    return type;
                }
            }
        }
        return Namespace.globals.get('any');
    } 

    static arrayToTuple(items,isTupleUnion=true, prefix=true,target=null){
        const mergeType = new MergeType(Namespace.globals.get('Array'));
        mergeType.hasTuplePrefix = prefix;
        mergeType.isTupleType = true
        mergeType.isTupleUnion = isTupleUnion;
        mergeType.target = target;
        items.forEach( item=>{
            mergeType.add(item);
        });
        return mergeType.type();
    }

    static arrayToUnion(items,target=null, toLiteralValue=false){
        const mergeType = new MergeType();
        mergeType.target = target;
        items.forEach( item=>{
            mergeType.add(item, toLiteralValue);
        });
        return mergeType.type();
    }

    static mergeTupleElement(type){
        if(!type || !type.isTupleType){
            return type;
        }
        if(type.elements.length>1){
            const base = type.elements.find(el=>{
                const type = el.type();
                return type.isTupleType && type.isTupleUnion && type.elements.length>1;
            })
            if(base){
                const baseType = base.type()
                const origArrayType = Namespace.globals.get('Array');
                const mergeType = new MergeType(origArrayType);
                mergeType.hasTuplePrefix = baseType.prefix;
                mergeType.isTupleType = true
                mergeType.isTupleUnion = baseType.isTupleUnion;
                mergeType.target = baseType.target;
                baseType.elements.forEach( item=>{
                    mergeType.add(item);
                });
                type.elements.forEach(item=>{
                    if(item !== base){
                        mergeType.add(item);
                    }
                })
                return Utils.setMergedType(new TupleType(origArrayType, [mergeType.type()], type.target, false, type.isTupleUnion, type.prefix));
            }
        }
        return type;
    }

}

module.exports = MergeType;