declare System{
    static is(left:any,right:Class|Interface):boolean;
    static isClass(target:any):boolean;
    static isInterface(target:any):boolean;
    static isFunction(target:any):boolean;
    static isArray(target:any):boolean;
    static isObject(target:any):boolean;
    static isString(target:any):boolean;
    static isScalar(target:any):boolean;
    static isNumber(target:any):boolean;
    static isBoolean(target:any):boolean;
    static toArray<T=any>(target:object):T[];
    static registerHook<T=any>(type:string, processer:(value?:T,...args)=>T, priority:number=0):void;
    static invokeHook<T=any>(type:string,...args):T;
    static setConfig(key:string, value:any):void;
    static getConfig<T>(key:string):T;
    static createHttpRoute(routePath:string, params?:{[key:string]:number|string}, flag?:boolean):string;
    static getDefinitionByName<T=any>(name:string):Class<T>;
    static hasClass(name:string):boolean;
    static getQualifiedClassName( target:Class ):string;
    static getQualifiedObjectName( target:object ):string;
    static getQualifiedSuperClassName(target:object):string | null;
}