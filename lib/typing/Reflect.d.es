
declare interface ClassDescriptorConfig{
    type:number
    class:class<any>
    className:string
    namespace:string
    dynamic:boolean
    isStatic:boolean
    privateKey:string
    implements:class<any>[]
    inherit:class<any>
    members:{[key:string]:any}
    methods:{[key:string]:any}
}


declare interface ClassMemberDescriptorConfig{
    type?:number
    class?:class<any>
    isStatic?:boolean
    privateKey?:string
    modifier?:number
    enumerable:boolean
    writable:boolean
    configurable:boolean
    //get:Function
    //set:Function
    value:any
    method?:Function
}

declare Reflect{
    static apply<T>(fun:()=>T, thisArgument?:object, argumentsList?:any[]):T;
    static call<T>(scope:class<any>,target:object,propertyKey:string,argumentsList?:any[],thisArgument?:object):T;
    static construct<T>(classTarget:class<T>, args?:any[]):T;
    static deleteProperty<T=object>(target:T, propertyKey:string):boolean;
    static has<T>(target:T, propertyKey:string):boolean;
    static get<T>(scope:class<any>,target:object,propertyKey:string,thisArgument?:object):T;
    static set<T>(scope:class<any>,target:object,propertyKey:string,value:any,thisArgument?:object):T;
    static incre(scope:class<any>,target:object,propertyKey:string,flag?:boolean):number;
    static decre(scope:class<any>,target:object,propertyKey:string,flag?:boolean):number;
    static getDescriptor(target:object):ClassDescriptorConfig | null;
    static getDescriptor(target:object, propertyKey?:string):null | ClassMemberDescriptorConfig;
}