declare interface ClassDescriptor{
    get isClassDescriptor():boolean
    get mode():number
    get descriptor():Record | null
    get classModule():class<any> | null
    get label():string
    get className():string
    get namespace():string
    get implements():any[]
    get inherit():class<any> | null
    get members():MemberDescriptor[]
    get permission():string
    isPrivatePropertyKey(key): boolean
    getMemberDescriptor(name:string, isStatic?:boolean):MemberDescriptor|null
    isPrivate():boolean
    isProtected():boolean
    isPublic():boolean
    isStatic():boolean
    isFinal():boolean
    isAbsract():boolean
    isDynamic():boolean
    isClass():boolean
    isInterface():boolean
    isEnum():boolean
    isStruct():boolean
}

declare interface MemberDescriptor{
    get isMemberDescriptor():boolean
    get mode():number
    get descriptor():Record | null
    get key():string
    get owner():class<any> | null
    get label():string
    get getter():Function | null
    get setter():Function | null
    get value():any
    get writable():boolean
    get configurable():boolean
    get enumerable():boolean
    get permission():string
    get privateKey():any
    isPrivate():boolean
    isProtected():boolean
    isPublic():boolean
    isStatic():boolean
    isFinal():boolean
    isAbsract():boolean
    isMethod():boolean
    isOptional():boolean
    isAccessor():boolean
    isProperty():boolean
    isEnumProperty():boolean
    isColumn():boolean
    isClassMember():boolean
    invokeMethod<T=any>(thisArg:Object, ...args):T
    invokeGetter<T=any>(thisArg:Object):T
    invokeSetter(thisArg, value:any):void
    setPropertyValue(value:any):void
}

declare Reflect{
    static MODIFIER_PUBLIC:number;
    static MODIFIER_PROTECTED:number;
    static MODIFIER_PRIVATE:number;
    static MODIFIER_STATIC:number;
    static MODIFIER_FINAL:number;
    static MODIFIER_ABSTRACT:number;
    static MODIFIER_OPTIONAL:number;
    static KIND_ACCESSOR:number;
    static KIND_PROPERTY:number;
    static KIND_READONLY:number;
    static KIND_METHOD:number;
    static KIND_ENUM_PROPERTY:number;
    static KIND_CLASS:number;
    static KIND_INTERFACE:number;
    static KIND_ENUM:number;
    static KIND_STRUCT:number;
    static KIND_STRUCT_COLUMN:number;
    static apply<T=any>(fun:()=>T, thisArgument?:object, argumentsList?:any[]):T;
    static call<T=any>(scope:class<any>,target:object,propertyKey:string,argumentsList?:any[],thisArgument?:object):T;
    static construct<T=any>(classTarget:class<T>, args?:any[]):T;
    static deleteProperty(target:object, propertyKey:string):boolean;
    static has(target:object, propertyKey:string):boolean;
    static get<T=any>(scope:class<any>|null,target:object,propertyKey:string,thisArgument?:object):T;
    static set<T=any>(scope:class<any>|null,target:object,propertyKey:string,value:T,thisArgument?:object):T;
    static incre(scope:class<any>|null,target:object,propertyKey:string,flag?:boolean):number;
    static decre(scope:class<any>|null,target:object,propertyKey:string,flag?:boolean):number;
    static getDescriptor(target:object):null | ClassDescriptor;
    static getDescriptor(target:object, propertyKey:string, mode?:number):null | MemberDescriptor;
    static getDescriptors(target:object,mode?:number):null | ClassDescriptor;
}