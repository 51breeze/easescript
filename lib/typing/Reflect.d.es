
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
    static apply<T=any>(fun:()=>T, thisArgument?:object, argumentsList?:any[]):T;
    static call<T=any>(scope:class<any>,target:object,propertyKey:string,argumentsList?:any[],thisArgument?:object):T;
    static construct<T=any>(classTarget:class<T>, args?:any[]):T;
    static deleteProperty(target:object, propertyKey:string):boolean;
    static has(target:object, propertyKey:string):boolean;
    static get<T=any>(scope:class<any>|null,target:object,propertyKey:string,thisArgument?:object):T;
    static set<T=any>(scope:class<any>|null,target:object,propertyKey:string,value:T,thisArgument?:object):T;
    static incre(scope:class<any>|null,target:object,propertyKey:string,flag?:boolean):number;
    static decre(scope:class<any>|null,target:object,propertyKey:string,flag?:boolean):number;
    static getDescriptor(target:object):ClassDescriptorConfig | null;
    static getDescriptor(target:object, propertyKey?:string):null | ClassMemberDescriptorConfig;
}