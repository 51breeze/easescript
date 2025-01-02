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
    isAccessor():boolean
    isProperty():boolean
    isEnumProperty():boolean
    isClassMember():boolean
    invokeMethod<T=any>(thisArg:Object, ...args):T
    invokeGetter<T=any>(thisArg:Object):T
    invokeSetter(thisArg, value:any):void
    setPropertyValue(value:any):void
}

declare Reflect{
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
    static getDescriptor(target:object, propertyKey:string):null | MemberDescriptor;
}