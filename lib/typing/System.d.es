/**
* System是一个静态类不能被实例化。
*/
declare System{

    /**
    * 判断一个对象的数据类型
    * @param left 是一个任意的对象.
    * @param right 是一个类或者接口类型.
    * 如果指定的对象属于指定的类或者接口则返回true否则返回false
    */
    static is(left:any,right:Class|Interface):boolean;

    /**
    * 判断指定的对象的是否为一个类
    * @param target 一个任意的对象.
    * 如果指定的target是一个类则返回true否则返回false
    */
    static isClass(target:any):boolean;

    /**
    * 判断指定的对象的是否为一个接口
    * @param target 一个任意的对象.
    * 如果指定的target是一个接口则返回true否则返回false
    */
    static isInterface(target:any):boolean;

    /**
    * 判断指定的对象的是否为一个函数
    * @param target 一个任意的对象.
    * 如果指定的target是一个函数则返回true否则返回false
    */
    static isFunction(target:any):boolean;
    
    /**
    * 判断指定的对象的是否为一个数组
    * @param target 一个任意的对象.
    * 如果指定的target是一个数组则返回true否则返回false
    */
    static isArray(target:any):boolean;

    /**
    * 判断指定的对象的是否为一个对象
    * @param target 一个任意的对象.
    * 如果指定的target是一个对象则返回true否则返回false
    */
    static isObject(target:any):boolean;

    /**
    * 判断指定的对象的是否为一个字符串
    * @param target 一个任意的对象.
    * 如果指定的target是一个字符串则返回true否则返回false
    */
    static isString(target:any):boolean;

    /**
    * 判断指定的对象的是否属于标量类型。标量类型包括字面量的:string,number,boolean,regexp,null。
    * @param target 一个任意的对象.
    * 如果指定的target是属于标量类型则返回true否则返回false
    */
    static isScalar(target:any):boolean;

    /**
    * 判断指定的对象的是否为一个数字
    * @param target 一个任意的对象.
    * 如果指定的target是一个数字则返回true否则返回false
    */
    static isNumber(target:any):boolean;

    /**
    * 判断指定的对象的是否为一个布尔值
    * @param target 一个任意的对象.
    * 如果指定的target是一个布尔值返回true否则返回false
    */
    static isBoolean(target:any):boolean;

    /**
    * 将一个可迭代的对象转换为数组
    * @param target 一个可迭代的对象.
    * 如果转换失败则返回null
    */
    static toArray<T=any>(target:object):T[];

    /**
    * 注册一个系统勾子函数在特定的时机调用
    * @param type 一个字符串标识符
    * @param processer 一个处理勾子的函数
    * @param priority 调用时的优先级，数字大的优先调用
    */
    static registerHook<T=any>(type:string, processer:(...args)=>T|void, priority:number=0):void;

    /**
    * 调用系统已注册的勾子函数
    * @param type 一个字符串标识符
    * @param args 传递给勾子的函数的一组参数
    */
    static invokeHook<T=any>(type:string,...args):T;

    /**
    * 设置一个配置项
    * @param key 一个字符串标识符
    * @param value 配置值
    */
    static setConfig(key:string, value:any):void;

    /**
    * 获取一个配置项的值
    * @param key 一个字符串标识符
    * 如果指定的key不存在则返回null,否则返回已设置的值。
    */
    static getConfig<T>(key:string):T;

    /**
    * 生成一个路由的完整路径
    * @param routePath 一个路由规则
    * @param params 一个对象表示需要组装到路由规则中的参数
    * @param flag 如果设置为true,在路由规则生成时有匹配到params中的属性值则会消费掉params中的属性
    * 如果生成失败则会抛出一个错误
    */
    static createHttpRoute(routePath:string, params?:{[key:string]:number|string}, flag?:boolean):string;

    /**
    * 获取指定名称的类
    * @param name 一个完整的类名称含命名空间
    */
    static getDefinitionByName<T=any>(name:string):Class<T>|null;

    /**
    * 判断指定的类是否存在
    * @param name 一个完整的类名称含命名空间
    */
    static hasClass(name:string):boolean;

    /**
    * 根据指定的类对象获取一个完整的类名
    * @param target 一个任意的类对象
    */
    static getQualifiedClassName( target:Class ):string;

    /**
    * 根据指定的实例对象获取一个完整的类名
    * @param target 一个任意的实例对象
    */
    static getQualifiedObjectName( target:object ):string;

    /**
    * 获取一个父类的完整类名
    * @param target 一个任意的实例对象
    */
    static getQualifiedSuperClassName(target:object):string | null;
}