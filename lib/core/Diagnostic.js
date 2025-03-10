const Lang = require('./Lang');
const constant = {};
const define=(code,name,message)=>{
    if( Lang.has(code) ){
        throw new Error(`code '${code}' already exists.`)
    }else{
        Lang.define(code, message);
        if(name){
            constant[name] = code;
        }
    }
}
const registereds = {};
class Diagnostic{
    constructor(file,message,range,kind,node,code){
        this.file = file;
        this.message = message;
        this.range = range;
        this.kind = kind;
        if(message === code && typeof code ==='string'){
            code = '';
        }
        this.node = node;
        this.code = code;
    }
    toString(){
        let message = this.message;
        let range = this.range;
        if( this.file ){
            message+= ` (${this.file}:${range.start.line}:${range.start.column}) ${this.code}`;
        }else{
            message+= ` (${range.start.line}:${range.start.column}) ${this.code}`;
        }
        return message;
    }
    static register(key, callback){
        if(!registereds[key]){
            registereds[key] = true;
            callback((code, cn, en=null)=>{
                if(!cn){
                    throw new Error("Language message can not is emty")
                }
                if(!en && cn)en = cn;
                Diagnostic.defineError(code, "",  [cn, en])
            })
        }
    }
    static defineError(code,name,value){
        if( code >= 10000 ){
            define(code,name,value);
        }else{
            throw new Error(`code '${code}' already exists.`)
        }
    }
    static getCodeByName(name){
        return constant[name];
    }
    static getMessage(code, args=[]){
        return Lang.get(code, ...args);
    }
}

Diagnostic.LANG_CN = 0;
Diagnostic.LANG_EN = 1;

Diagnostic.ERROR = 0;
Diagnostic.WARN = 1;
Diagnostic.DEPRECATED = 2;
Diagnostic.UNNECESSARY = 3;

define(1000,"",[
    "函数参数期望有%s个，当前给了%s个",
    "Expected %s arguments, but got %s"
]);

define(1001,"",[
    "函数参数期望有%s个，当前给了%s个",
    "Expected %s arguments, but got %s",
]);

define(1002,"",[
    "指定的实参类型(%s), 不能分配给声明的形参类型(%s)",
    `Argument of type '%s' is not assignable to parameter of type '%s'`,
]);

define(1003,"",[
    "指定的类型(%s)不能满足声明的约束类型(%s)",
    "Type '%s' does not satisfy the constraint '%s'",
]);

define(1004,"",[
    "泛型参数期望是 %s 个，但指定了 %s 个",
    "Expected %s type arguments, but got %s",
]);

define(1005,"",[
    "泛型参数期望是 %s-%s 个，但指定了 %s 个",
    "Expected %s-%s type arguments, but got %s",
]);

define(1006,"",[
    "引用名(%s)，不是一个可调用的方法",
    "'%s' is not callable",
]);

define(1007,"",[
    "变量不能重复声明(%s)",
    "Variable '%s' cannot redeclare",
]);

define(1008,"",[
    "声明的变量名(%s)与类名冲突",
    "Variable '%s' conflicts with the current class name.",
]);

define(1009,"",[
    "引用的表达式类型(%s)不能分配给指定的类型(%s)",
    "Type '%s' is not assignable to assignment of type '%s'",
]);

define(1010,"",[
    "指定引用的变量不能是自身(%s)",
    "Variable '%s' cannot reference to itself.",
]);

define(1011,"",[
    "变量名(%s),隐含着(any)类型,但是可以为其赋值后能推断出更适合的类型",
    "Variable '%s' implicitly has an 'any' type, but a better type may is inferred from usage.",
]);

define(1012,"",[
    "展开数组表达式(%s)的类型必须是一个数组，当前引用的类型(%s)",
    "Spread '%s' expression, must is an array type. give %s",
]);

define(1013,"",[
    "引用名(%s)没有定义",
    "'%s' is not defined",
]);

define(1014,"",[
    "展开数组(%s[%s]),已超出索引下标",
    "Spread %s[%s] out of range, is not assign initial value.",
]);

define(1015,"",[
    "引用名(%s)是一个不可写的声明",
    "'%s' is not writable",
]);

define(1016,"",[
    "有初始值的参数不需要标记为可选参数",
    "Parameter with a initial value cannot is marked as optional",
]);

define(1017,"",[
    "表达式(await),只能引用声明为同步的函数",
    "Await expression are only allowed within async function",
]);

define(1018,"",[
    "表达式(await),只能引用声明为同步的函数",
    "Await expression needs to return a promise type",
]);

define(1019,"",[
    "引用(%s),不是一个实例对象",
    "The refs '%s' is not instance object",
]);

define(1020,"",[
    "引用(%s),可能不是一个实例对象",
    "The refs '%s' maybe is not instance object",
]);

define(1021,"",[
    "实例运算符(%s),在右边表达式中必须是一个类型引用",
    "Operator the '%s' right-hand refs is not class type",
]);

define(1022,"",[
    "语法(Break)指定的标签(%s)表达式不存在或者已跨越边界",
    "Jump target is not exists or has crossed boundary",
]);

define(1023,"",[
    "语法(Break)只能出现在循环语句中",
    "Break must is contain in the 'switch,while,do,for'",
]);

define(1024,"",[
    "%s是一个循环引用. %s > %s > %2",
    "%s to circular dependency. %s > %s > %2",
]);

define(1025,"",[
    "导入的模块(%s)已经存在",
    "Import '%s' module already exists.",
]);

define(1026,"",[
    "导入的模块(%s)没有找到",
    "Import '%s' is not exists.",
]);

define(1027,"",[
    "引用的类(%s)不存在",
    "Class '%s' is not exists",
]);

define(1028,"",[
    "在类的(implements)表达式中,指定的标识符不是接口类型",
    "Implements '%s' is not interface",
]);

define(1029,"",[
    "在类的(implements)表达式中,指定的接口类型不存在",
    "Implements '%s' is not exists",
]);

define(1030,"",[
    "指定的泛类型(%s)需要有 %s 个类型参数",
    "Generic '%s' requires %s type arguments",
]);

define(1031,"",[
    "类泛型(%s)需要有 %s-%s 个类型参数",
    "Generic '%s' requires %s-%s type arguments",
]);

define(1032,"",[
    "指定的接口成员(%1),没有在此类中实现",
    "The '%s' %s in the %s is not implemented in the %s",
]);

define(1033,"",[
    "实现接口成员(%s)的类型不匹配",
    "Implementing the type mismatch of the interface member '%s'. must is '%s' type"
]);

define(1034,"",[
    "实现接口成员(%1)不兼容",
    "The '%s' inconformity with the %s in the '%s'",
]);

define(1035,"",[
    "实现接口(%1)中,参数缺失",
    "The '%s' %s params missing with the %s params in the '%s'",
]);

define(1036,"",[
    "实现接口(%1)中，参数的类型不匹配",
    "The '%s' %s params type not matched with the %s params in the '%s3'",
]);

define(1037,"",[
    "实现接口(%1)中，泛型的数目不一致",
    "The '%s' %s declare generics number inconsistency in the '%s'",
]);

define(1038,"",[
    "实现接口(%1),泛型约束类型不匹配",
    "The '%s' %s generics does not satisfy constraint with the '%s'",
]);

define(1039,"",[
    "实现接口(%1)中,访问命名空间的修饰符不一致",
    "the '%s' %s modifier is not consistent with the %s modifier in the '%1'",
]);

define(1040,"",[
    "声明的别名类型(%s)必须指定一个类型值",
    "Declare '%s' alias type must assignment a type",
]);

define(1041,"",[
    "缺少条件",
    "Missing condition",
]);

define(1042,"",[
    "循环语句体中缺少退出语句，可能会导致无限循环",
    "The absence of an exit statement in the body of a do while statement may result in an infinite loop",
]);

define(1043,"",[
    "无效的标识符",
    "Token(%s) invalid",
]);

define(1044,"",[
    "枚举属性(%s)的初始值只能是数字或者字符串",
    "Enum property the '%s' initial value of can only is number or string",
]);

define(1045,"",[
    "属性(%s)已经存在，不能重复定义",
    "Property the '%s' already exists. cannot redefined",
]);

define(1046,"",[
    "引用的值必须是对象",
    "The refs value of '%s' is not an object",
]);

define(1047,"",[
    "循环(%s)中只能声明单个变量",
    "Only a single variable declaration is allowed in a '%s' statement",
]);

define(1048,"",[
    "循环(%s)声明的变量不能有初始值",
    "The variable declaration of a '%s' statement cannot have an initial",
]);

define(1049,"",[
    "引用的值可能不是对象值",
    "The refs value of '%s' maybe is not an object",
]);

define(1050,"",[
    "带有初始值的参数(可选参数)只能跟在必填参数的后面",
    "The '%s' parameter with an initial value in method can only is declared after the parameter",
]);

define(1051,"",[
    "剩余参数只能在参数的结尾",
    "The '%s' rest parameter can only appear at the end of the params",
]);

define(1052,"",[
    "构造函数中不需要有返回值",
    "Constructor does not need to return value",
]);

define(1053,"",[
    "构造函数中必须先调用超类方法(super)",
    "Constructor must first call super",
]);

define(1054,"",[
    "函数声明的类型必须有返回值",
    "A function whose declared type is neither 'void' nor 'any' must return a value",
]);

define(1055,"",[
    "声明为异步的函数必须返回专有类型(%s)",
    "The return type of an async function or method must is the '%s' type",
]);

define(1056,"",[
    "声明的泛型已经存在",
    "Generic '%s' is already exists",
]);

define(1057,"",[
    "声明的泛型与类型名冲突",
    "Generic '%s' conflicts with type name.",
]);

define(1058,"",[
    "声明泛型的参数，不能跟在可选参数的后面",
    "Required type parameters may not follow optional type parameters",
]);

define(1059,"",[
    "当前的引用(%s)指向一个类型，不能当作值传递",
    "'%s' only refers to a type, but is being used as a value here.",
]);

define(1060,"",[
    "引用(%s)不存在",
    "'%s' does not exist.",
]);

define(1061,"",[
    "引用(%s)不可访问",
    "'%s' is not accessible.",
]);

define(1062,"",[
    "不能在构造函数上声明泛型",
    "Generic cannot is declared on constructor",
]);

define(1063,"",[
    "类中成员方法(%1)在父类中不存在，不需要标记重写(@Override))注解符",
    "The '%s' %s does not exists in the superclass. remove the '@Override' annotator if not overwrite.",
]);

define(1064,"",[
    "类中成员方法(%1)在父类中存在，需要标记重写(@Override)注解符",
    "the '%s' %s already exists in the superclass. use the '@Override' annotator if need overwrite",
]);

define(1065,"",[
    "获取访问器(%s)不需要声明参数",
    "'%s' getter does not defined param",
]);

define(1066,"",[
    "获取访问器(%s)需要返回值",
    "'%s' getter accessor must have a return value",
]);

define(1067,"",[
    "设置访问器(%s)需要声明一个参数",
    "'%s' setter must have one param",
]);

define(1068,"",[
    "访问器(%s)的接收类型不匹配",
    "'%s' setter and getter parameter types do not match",
]);

define(1069,"",[
    "当前引用(%s)不是一个可被实例化的类对象",
    "Reference the '%s' is not an instantiable class object",
]);

define(1070,"",[
    "当前引用(%s)是一个抽象类，不能被实例化对象",
    "'%s' is an abstract class. cannot is instantiated.",
]);

define(1071,"",[
    "剩余参数只能是一个元组类型",
    "Rest accept type must is tuple type",
]);

define(1072,"",[
    "返回表达式只能在函数体中",
    "Return expression must in function body",
]);

define(1073,"",[
    "当前的引用不能转换为一个数组",
    "The '%s' cannot convert a reference to an array",
]);

define(1074,"",[
    "当前的引用不能转换为一个对象",
    "The '%s' cannot convert a reference to an object",
]);

define(1075,"",[
    "调用超类(super)方法需要在子类中",
    "'super' no inherit parent class",
]);

define(1076,"",[
    "超类方法(super)只能在类方法中调用",
    "'super' can only is called in class methods",
]);

define(1077,"",[
    "元组类型中声明的剩余类型只能出现在元素的结尾",
    "Tuple type rest parameter must follow the end",
]);

define(1078,"",[
    "声明的类型(%s)已经存在",
    "Declare type '%s' already exists",
]);

define(1079,"",[
    "缺少类型引用",
    "Missing type expression",
]);

define(1080,"",[
    "属性名(%s)不存在",
    "Property '%s' is not exists",
]);

define(1081,"",[
    "展开对象表达式必须设置一个初始值",
    "Spread object expression, must have initial",
]);

define(1082,"",[
    "当前属性(%s)与父类中的成员有冲突",
    "Property '%s' conflicts with a member of the parent class",
]);

define(1083,"",[
    "引用(%s)的类型不存在",
    "Type '%s' is not exists",
]);

define(1084,"",[
    "声明的参数，不能跟在可选参数的后面",
    "Required parameters may not follow optional type parameters",
]);

define(1085,"ERROR",[
    "解析语法错误",
    "Parsing syntax error",
]);

define(1086,"",[
    "指定类型为(%s)的数组元素，不能在数组索引位置指定类型",
    "Specifies an array element of '%s' type. the type cannot is specified at the array index",
]);

define(1087,"",[
    "更新表达式(%s)的引用类型必须是一个数字类型",
    "The reference type of the update expression '%s' must is a numeric type",
]);

define(1088,"",[
    "需要重写的方法(%s)参数数目不一致",
    "Inconsistent number of the '%s' method arguments to override",
]);

define(1089,"",[
    "需要重写的存储器(%s)参数数目不一致",
    "Inconsistent number of the '%s' setter arguments to override",
]);

define(1090,"",[
    "实现接口(%s)中的参数不兼容",
    "Implemented interface parameters is not compatible in the '%s' method",
]);

define(1091,"",[
    "片段表达式只能出现在结尾",
    "fragment expressions can only appear at the end",
]);

define(1092,"",[
    "注解Runtime方法参数值只能是'server,client'",
    "Annotations runtime method parameters can only is 'server' or 'client'",
]);

define(1093,"",[
    "注解方法在此位置未生效",
    "Annotation method not in effect at this location",
]);

define(1094,"",[
    "在此处声明的导入语无效",
    "The import declared here is invalid",
]);

define(1095,"",[
    "指定加载的类型描述文件无效",
    "The type description file specified to load is invalid",
]);

define(1096,"",[
    "声明的全局函数(%s)已经存在",
    "Declare globals function '%s' already exists",
]);

define(1097,"",[
    "声明的属性(%s)已经存在",
    "Declare globals property '%s' already exists",
]);

define(1098,"",[
    "指定的XML命名空间(%s)没有定义",
    "The specified XML namespace '%s' is not defined",
]);

define(1099,"",[
    "引用的命名空间不存在",
    "The '%s' namespace does not exist",
]);

define(1100,"",[
    "嵌入的文件没有找到",
    "Embed file '%s' not found",
]);

define(1101,"",[
    "缺失嵌入的文件",
    "Embed file missing",
]);

define(1102,"",[
    "嵌入注解符只能定义在包或者顶级域中",
    "Embed annotations can only is defined in a package or top-level scope",
]);

define(1103,"",[
    "注解符(%s)只能定义在顶级域、包或者类中",
    "%s annotations can only is defined in a top-level scope or package or class",
]);

define(1104,"",[
    "注解符(%s)只能定义在方法或者属性上",
    "%s annotations can only is defined in a methods or property of class members",
]);

define(1105,"",[
    "注解符(%s)只能定义在类上",
    "%s annotations can only is defined in a class",
]);

define(1106,"",[
    "嵌入注解符指定的资源已经存在",
    "Embed annotations '%s' assets already exists",
]);

define(1107,"",[
    "声明的引用(%s)已经存在",
    "Declare refs '%s' already exists",
]);

define(1108,"",[
    "元素标签名不符合标准",
    "JSX element tag name does not is standard",
]);

define(1109,"",[
    "子类的父级必须是一个根元素组件",
    "JSX the parent of subclass must is root element components",
]);

define(1110,"",[
    "不支持的代码块",
    "JSX Unsupported",
]);

define(1111,"",[
    "元素组件(%s)不存在",
    "Component '%s' is not exists",
]);

define(1112,"",[
    "在根元素组件中的子类已经存在",
    "JSX subclass already exist in the root element components",
]);

define(1113,"",[
    "元素属性的子级只能是一个表达式",
    "JSX the value of element properties can only is a expression",
]);

define(1114,"",[
    "元素指令无效",
    "JSX element directive '%s' invalid",
]);

define(1115,"",[
    "根元素上不能使用指令",
    "JSX directives cannot is used on the root element",
]);

define(1116,"",[
    "元素指令(each)表达式错误, 正确写法是:'item of fromArray'",
    "JSX element directives 'each' expression error, correct be: 'item of fromArray'",
]);

define(1117,"",[
    "XML命名空间只能定义在根元素上",
    "JSX namespaces can only is defined on the root element",
]);

define(1118,"",[
    "没有找到指定的文件",
    "Not found the '%s'",
]);

define(1119,"",[
    "指令(EACH)的引用只能是一个数组. 当前为(%s)",
    "JSX references to the 'each' directive can only is an array. but got '%s'",
]);

define(1120,"",[
    "指令(FOR)的引用类型必须是一个可迭代的对象",
    "JSX references to the 'for' directive must is an iterator object. but got '%s'",
]);

define(1121,"",[
    "元素指令(for)表达式错误, 正确写法是:'value in fromIteration'",
    "JSX element directives 'for' expression error, correct be: '(value,key[optional],index[optional]) in fromIteration'",
]);

define(1122,"",[
    "加载依赖(%s)文件不存在。请先安装此依赖",
    "Require '%s' does not exist. try npm install %1",
]);

define(1123,"",[
    "多个元素必须包裹在一个容器中",
    "JSX Multiple elements must is wrapped in a container",
]);

define(1124,"",[
    "'%s' 是一个被保留的标识符",
    "The '%s' is a reserved identifier",
]);

define(1125,"",[
    "指定的命名空间下可用元素为:%s",
    "JSX the '%s' available elements in the specified namespace",
]);

define(1126,"",[
    "引用插槽(%s)在父组件中没有定义",
    "JSX refs of the slot '%s' is not defined in the parent component",
]);

define(1127,"",[
    "插槽(%s)的父级不是一个web组件",
    "JSX parent of the slot '%s' is not web-component",
]);

define(1128,"",[
    "插槽(%s)使用的参数在父级组件的插槽中没有定义",
    "JSX the slot '%s' used parameters is not defined in the slot of the parent component",
]);

define(1129,"",[
    "插槽(%s)已经定义过",
    "JSX the slot (%s) is already defined",
]);

define(1130,"",[
    "插槽(%s)没有声明作用域",
    "JSX the slot '%s' does not declared scope",
]);

define(1131,"",[
    "组件元素没有声明默认插槽来接收或者处理子元素，是否考虑将其删除？",
    "Component is not declared default slots to receive or process child elements. would you consider delete them?",
]);

define(1132,"",[
    "引用的文件(%s)不存在",
    "References file '%s' does not exist",
]);

define(1133,"",[
    "缺少返回表达式",
    "Missing return expression",
]);

define(1134,"",[
    "JSX 组件元素(%s)必须继承'web-component'",
    "JSX the '%s' element components must inherit 'web-component'",
]);

define(1135,"",[
    "注解(%s)表达式参数无效",
    "The '%s' annotation expression arguments is invalid",
]);

define(1136,"",[
    "成员属性(%s)不能被重写",
    "The '%s' members property cannot is overridden",
]);

define(1137,"",[
    "注解符(%s)不能绑定多个入口方法",
    "Annotation the '%s' cannot bind multiple entry methods in an class",
]);

define(1138,"",[
    "注解符(%s)只能绑定在公开且为静态的方法上",
    "Annotation the '%s' can only is bound to public and static methods",
]);

define(1139,"",[
    "动态属性的索引(%s)类型只能是字符串或者数字类型",
    "The '%s' index type of dynamic property can only is string or number",
]);

define(1140,"",[
    "注解符(%s)不存在。可以在(compiler.options.annotations)中添加注解符",
    "Annotation the '%s' does not exist. but you can also register annotations through 'compiler.options.annotations'",
]);

define(1141,"",[
    "类型(%s)是一个循环引用",
    "Type '%s' refs to circular",
]);

define(1142,"",[
    "成员(%s)是一个只读属性",
    "The '%s' property is readonly",
]);

define(1143,"",[
    "容器指令不能再指定属性指令",
    "Directives container can no longer set attribute directive",
]);

define(1144,"",[
    "容器指令缺少属性",
    "Directives container missing attributes. expect '%s'",
]);

define(1145,"",[
    "容器指令属性期望%s个,但设置了%s个。期望属性(%s)",
    "Directives container attributes expect %s. but got %s. available attributes the '%s'",
]);

define(1146,"",[
    "容器指令属性的值只支持表达式",
    "Only expressions is supported for value of container directive properties",
]);

define(1147,"",[
    "类型(%s)不能继承为终态类(%s)的子类",
    "Type '%s' cannot is inherited as a subclass of the final class '%s'",
]);

define(1148,"",[
    "终态方法(%s)不能被重写",
    "The final method '%s' cannot is overridden",
]);

define(1149,"",[
    "终态属性(%s)不能被重写",
    "The final property '%s' cannot is overridden",
]);

define(1150,"",[
    "类型(%s)不能用作索引类型",
    "Type '%s' cannot is used as an index type",
]);

define(1151,"",[
    "不能在扩展参数体之外指定类型",
    "Type cannot is specified outside of an spread parameter body",
]);

define(1152,"",[
    "缺少对象属性(%s)",
    "Missing object property the '%s'",
]);

define(1153,"",[
    "枚举成员必须具有初始值",
    "Enum member must have initial value",
]);

define(1154,"",[
    "扩展参数必须具有元组类型或传递给剩余参数",
    "A spread argument must either have a tuple type or is passed to a rest parameter",
]);

define(1155,"",[
    "长度为'%s'的元组类型'%s',在索引'%s'处没有元素",
    "Tuple type '%s' of length '%s' has no element at index '%s'",
]);

define(1156,"",[
    "指令'else'只能出现在'if'条件之后",
    "Directives the 'else' can only appear after the 'if' condition",
]);
define(1157,"",[
    "指定具有插槽(%s)元素的父级必须是一个web组件类型",
    "Specifies that the parent with slot(%s) elements must is a Web component type",
]);

define(1158,"",[
    "属性(%s)是一个循环引用",
    "The '%s' is a circular references",
]);

define(1159,"",[
    "导出语句只能出现在顶级块中",
    "Export statements can only appear in top-level blocks",
]);

define(1160,"",[
    "非描述文件和片段文件中的导出语句会被忽略",
    "Export statements in non-description and fragment files are ignored",
]);

define(1161,"",[
    "模块(%s)不能被导入,因为(%1)不是主模块",
    "The '%s' cannot is imported. because '%1' is not the main module.",
]);

define(1162,"",[
    "指定的来源(%s)没有导出内容",
    "The specified source does not have an export statement. in '%s'",
]);
define(1163,"",[
    "一个模块中不能有多个默认导出",
    "A module cannot have multiple default exports",
]);
define(1164,"",[
    "模块(%s)没有导出成员(%s),您是否打算使用\`import %2 from '%1'\`来替换",
    "Module '%s' has no exported member '%s'. Did you mean to use \`import %2 from '%1'\` instead?",
]);

define(1165,"",[
    "引用元语句(%s)不存在, 可用的方法:%2",
    "Reference meta statement '%s' does not exist, available methods:'%2'",
]);

define(1166,"",[
    "引用的字段名(%s)不存在",
    "The '%s' field name does not exist",
]);
define(1167,"",[
    "至少需要指定一个字段名",
    "Least one field name needs to is specified",
]);
define(1168,"",[
    "索引名不能重复定义",
    "The index name already defined",
]);
define(1169,"",[
    "插槽的作用域参数名必须是一个字面量标识符",
    "The scope parameter name of the slot must is literal identifier",
]);
define(1170,"",[
    "声明插槽的作用域参数(%s)必须给一个初始值或者引用",
    "Slots scope arguments the '%s' must have a initial value when declared",
]);
define(1171,"",[
    "属性指令表达式必须是一个字面对象类型",
    "Attributes directive-expression must is a literal-object and contains 'name,value' properties.",
]);

define(1172,"",[
    "缺少属性值",
    "Missing attribute value",
]);

define(1173,"",[
    "自定义指令必须包含'name'和'value'属性",
    "Custom directives must contains name and value properties.",
]);

define(1174,"",[
    '指令组件的子级只能是一个VNode的类型',
    "Child of directive-component can only is of a VNode"
]);

define(1175,"",[
    '引用的类型(%s)不存在',
    "Reference type '%s' does not exist"
]);

define(1176,"",[
    '不支持的表达式(%s)',
    "Expression the '%s' is not supported"
]);
define(1177,"",[
    '不支持同类型嵌套分配',
    "Nested assignments of the same type '%s' is not supported"
]);
define(1178,"",[
    '表达式"%s"已被设置为专有语法作用域，在当前代码中只能当类型引用。但是您可以通过配置作用域来改变这种行为',
    "The '%s' was set proprietary syntax scope. so it can only be referenced as a type in this coding. but you can change this behavior by configure the scope"
]);

define(1179,"",[
    "根元素组件(%s)必须继承'web.components.Skin' 或者 'web.components.Component'",
    "the '%s' root element components must inherit 'web.components.Skin' or 'web.components.Component'",
]);

define(1180,"",[
    "声明的模块(%s)类型必须在文档的顶级作用域中",
    "Declared module type the '%s' must is in the top-level scope of the document",
]);


define(1181,"",[
    "引用的方法或者属性已被标记为已删除",
    "Referenced the '%s' method or property is removed",
]);

define(1182,"",[
    "引用的方法或者属性已弃用",
    "Referenced the '%s' method or property is deprecated. %s",
]);
define(1183,"",[
    "'%s'已声明，但是没有任何引用",
    "'%s' is declared but its value is never read",
]);
define(1184,"",[
    "检测到不会执行的代码",
    "Unreachable code detected",
]);

define(1185,"",[
    "调用了一个空操作的函数",
    "A meaningless function was called",
]);

define(1186,"",[
    "在同条件中已经存在相同类型的断言，表达式(%s)可以去掉",
    "An assertions of the same type already exists in the same conditions, the '%s' expression is meaningless",
]);

define(1187,"",[
    `"逻辑与"类型断言引用了相同表达式，可能无法同时满足条件是否需要修正？`,
    `The 'logical and' type assertions refers to the same expressions and may not satisfy conditions. are you to fix it?`,
]);

define(1188,"",[
    `引用的对象存在歧义，应当在引用前断言对象类型`,
    `Refers object have ambiguous. use type-assertion for this object on before refers it`,
]);

define(1189,"",[
    `暂不支持的语法节点(%s)`,
    `Unrecognized token '%s'`,
]);

define(1190,"",[
    `引用的对象有可能是空值，应当在引用前判断对象不为空或者使用可选链(?.)运算符获取属性(%s)值`,
    `Refers object may be null should check this object is not null on before refers it or use optional-chain operator(?.) that gets the value of this '%s' property`,
]);

define(1191,"",[
    `条件判断存在互斥的表达式`,
    `Conditional test existed mutually exclusive expressions`,
]);

define(1192,"",[
    `导出赋值不能与其它导出元素一起在模块中使用`,
    `An export assignment cannot be used in a module with other exported elements`,
]);

define(1193,"",[
    "模块(%1)没有具名导出,是否打算使用\`import * as %2 from '%1'\`来替换",
    "Module '%s' has no named exported. Did you mean to use \`import * as %2 from '%1'\` instead?",
]);

define(1194,"",[
    "不能在描述文档的全局包中使用导出",
    "The export cannot is used in the global package of the descriptor documents",
]);

define(1195,"",[
    "导出描述符(%s)已经存在(%s)包中",
    "Export the '%s' descriptors is alreay exists. in the '%s' package",
]);

define(1196,"",[
    "引用(%s)必须是一个声明的函数参数",
    "References '%s' must is declared function params",
]);

define(1197,"",[
    "指定的全命名空间只能声明在模块的顶级域中",
    "The specified full-namespace can only is declare in module top-level scoped",
]);

define(1198,"",[
    "表达式是一个无值(void)类型，所以此处的赋值没有意义",
    "The expression is of type void, so the assignment here is meaningless.",
]);

define(1199,"",[
    "引用名(%s)与导入模块冲突",
    "Reference name '%s' conflicts with the '%s'",
]);

define(1200,"",[
    "静态方法没有继承父类属性或者方法，所以不需要使用(Override)注解符",
    "Static methods no was inherit this parent class attributes or methods, so not need to use the 'Override' annotations",
]);

define(1201,"",[
    "声明的枚举表达式只对key-value的映射支持，不支持方法或者属性的定义。但它可以使用枚举模块来支持",
    "Declared enum expression support only key-value mappings, not method or attribute definitions. but it can using the enum module to supported",
]);

define(1202,"",[
    "声明的枚举表达式不支持继承和接口。但它可以使用枚举模块来支持",
    "Declared enum expression do not support extends and implements. but it can using the enum module to supported",
]);

define(1203,"",[
    "枚举模块只能继承枚举类型",
    "Enum module can only extends enum types",
]);

define(1204,"",[
    "容器指令缺少引用表达式(%s)",
    "Directives container misssing references expression the '%s'",
]);

define(1205,"",[
    "根元素上只能定义命名空间属性",
    "Root element can only define namespace-attributes",
]);

define(1206,"",[
    "指定的参数(%s)没有被声明，应该在类型定义时先声明或者删除此参数",
    "Arguments the '%s' is not declared and should is declare at type definition or removed this arguments",
]);

module.exports = Diagnostic;
//Root element  only  can defined namespace attributes