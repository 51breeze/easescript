
const constant = {};
const dataset  = {};
const define=(code,name,message)=>{
    if( dataset[code] ){
        throw new Error(`code '${code}' already exists.`)
    }
    dataset[code]  = message;
    constant[name] = code;
}
class Diagnostic{
    constructor(file,message,range,kind,node,code){
        this.file = file;
        this.message = message;
        this.range = range;
        this.kind = kind;
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
    static getMessage(id, code, args=[]){
       const message = dataset[code] && dataset[code][id] || 'unknown';
       let index = 0;
       return message.replace(/(%([s|S]|\d+))/g, (name)=>{
            const at = parseInt(name.substr(1,1));
            const result = at > 0 ? args[at-1] : args[index++];
            return result === void 0 ? 'unknown' : result;
       });
    }
}

Diagnostic.LANG_CN = 0;
Diagnostic.LANG_EN = 1;

define(1000,"MISSING_ARGUMENT",[
    "函数参数期望有%s个，当前给了%s个",
    "Expected %s arguments, but got %s"
]);

define(1001,"INCONSISTENT_ARGUMENT",[
    "函数参数期望有%s个，当前给了%s个",
    "Expected %s arguments, but got %s",
]);

define(1002,"TYPE_ASSIGNABLE_NOT_MATCHED",[
    "指定的实参类型(%s), 不能分配给声明的形参类型(%s)",
    `Argument of type '%s' is not assignable to parameter of type '%s'`,
]);

define(1003,"GENERIC_ASSIGNABLE_NOT_CONSTRAINT",[
    "指定的类型(%s)不能满足声明的约束类型(%s)",
    "Type '%s' does not satisfy the constraint '%s'",
]);

define(1004,"GENERIC_ARGUMENT_NUMBER_INCONFORMITY",[
    "泛型参数期望是 %s 个，但指定了 %s 个",
    "Expected %s type arguments, but got %s",
]);

define(1005,"GENERIC_ARGUMENT_NUMBER_INCONFORMITY_RANGE",[
    "泛型参数期望是 %s-%s 个，但指定了 %s 个",
    "Expected %s-%s type arguments, but got %s",
]);

define(1006,"REFS_FUN_IS_NOT_CALLABLE",[
    "引用名(%s)，不是一个可调用的方法",
    "'%s' is not callable",
]);

define(1007,"REFS_VARIABLE_CANNOT_REDECLARE",[
    "变量不能重复声明(%s)",
    "Variable '%s' cannot redeclare",
]);

define(1008,"REFS_VARIABLE_CONFLICTS_WITH_CLASS",[
    "声明的变量名(%s)与类名冲突",
    "Variable '%s' conflicts with the current class name.",
]);

define(1009,"REFS_TYPE_ASSIGNABLE_NOT_MATCHED",[
    "指定引用值的类型(%s)与分配给指定变量的类型(%s)不匹配",
    "Type '%s' is not assignable to assignment of type '%s'",
]);

define(1010,"REFS_VARIABLE_CANNOT_IS_ITSELF",[
    "指定引用的变量不能是自身(%s)",
    "Variable '%s' cannot reference to itself.",
]);

define(1011,"REFS_VARIABLE_CANNOT_IS_ITSELF",[
    "变量名(%s),隐含着(any)类型,但是可以为其赋值后能推断出更适合的类型",
    "Variable '%s' implicitly has an 'any' type, but a better type may is inferred from usage.",
]);

define(1012,"REFS_SPREAD_NOT_IS_ARRAY",[
    "展开数组表达式(%s)的类型必须是一个数组，当前引用的类型(%s)",
    "Spread '%s' expression, must is an array type. give %s",
]);

define(1013,"REFS_IS_NOT_DEFINED",[
    "引用名(%s)没有定义",
    "'%s' is not defined",
]);

define(1014,"REFS_SPREAD_ARRAY_OUT_INDEX_RANGE",[
    "展开数组(%s[%s]),已超出索引下标",
    "Spread %s[%s] out of range, is not assign initial value.",
]);

define(1015,"REFS_IS_NOT_WRITABLE",[
    "引用名(%s)是一个不可写的声明",
    "'%s' is not writable",
]);

define(1016,"PARAMETER_CANNOT_HAVE_QUESTION_AND_INITIAL",[
    "有初始值的参数不需要标记为可选参数",
    "Parameter with a initial value cannot is marked as optional",
]);

define(1017,"AWAIT_EXPRESSION_MUST_ASYNC_FUN",[
    "表达式(await),只能引用声明为同步的函数",
    "Await expression are only allowed within async function",
]);

define(1018,"AWAIT_EXPRESSION_MUST_RETURN_PROMISE",[
    "表达式(await),只能引用声明为同步的函数",
    "Await expression needs to return a promise type",
]);

define(1019,"REFS_IS_NOT_INSTANCE_OBJECT",[
    "引用(%s),不是一个实例对象",
    "The refs '%s' is not instance object",
]);

define(1020,"REFS_MAYBE_IS_NOT_INSTANCE_OBJECT",[
    "引用(%s),可能不是一个实例对象",
    "The refs '%s' maybe is not instance object",
]);

define(1021,"OPERATOR_RIGHT_HAND_NOT_IS_CLASS",[
    "实例运算符(%s),在右边表达式中必须是一个类型引用",
    "Operator the '%s' right-hand refs is not class type",
]);

define(1022,"BREAK_JUMP_CANNOT_CROSS_BLOCK",[
    "语法(Break)指定的标签(%s)表达式不存在或者已跨越边界",
    "Jump target is not exists or has crossed boundary",
]);

define(1023,"BREAK_NOT_IN_LOOP",[
    "语法(Break)只能出现在循环语句中",
    "Break must is contain in the 'switch,while,do,for'",
]);

define(1024,"IMPORT_REFS_TO_CIRCULAR_DEPS",[
    "%s是一个循环引用. %s > %s > %2",
    "%s to circular dependency. %s > %s > %2",
]);

define(1025,"IMPORT_REFS_ALREADY_EXISTS",[
    "导入的模块(%s)已经存在",
    "Import '%s' module already exists.",
]);

define(1026,"IMPORT_REFS_NOT_EXISTS",[
    "导入的模块(%s)没有找到",
    "Import '%s' is not exists.",
]);

define(1027,"CLASS_REFS_NOT_EXISTS",[
    "引用的类(%s)不存在",
    "Class '%s' is not exists",
]);

define(1028,"IMPLEMENTS_REFS_NOT_INTERFACE",[
    "在类的(implements)表达式中,指定的标识符不是接口类型",
    "Implements '%s' is not interface",
]);

define(1029,"IMPLEMENTS_REFS_NOT_INTERFACE",[
    "在类的(implements)表达式中,指定的接口类型不存在",
    "Implements '%s' is not exists",
]);

define(1030,"CLASS_GENERIC_MISSING_ARGS",[
    "指定的泛类型需要有 %s 个类型参数",
    "Generic '%s' requires %s type arguments",
]);

define(1031,"CLASS_GENERIC_MISSING_ARGS_RANGE",[
    "类泛型(%s)需要有 %s-%s 个类型参数",
    "Generic '%s' requires %s-%s type arguments",
]);

define(1032,"INTERFACE_MEMBER_NOT_IMPLEMENTED",[
    "指定的接口成员(%1),没有在此类中实现",
    "The '%s' %s in the %s is not implemented in the %s",
]);

define(1033,"INTERFACE_RETURN_TYPE_NOT_MATCHED",[
    "实现接口成员(%s)的类型不匹配",
    "Implementing the type mismatch of the interface member '%s'. must is '%s' type"
]);

define(1034,"INTERFACE_MEMBER_INCONFORMITY",[
    "实现接口成员(%1)不兼容",
    "The '%s' inconformity with the %s in the '%s'",
]);

define(1035,"INTERFACE_MEMBER_MISSING_PARAMS",[
    "实现接口(%1)中,参数缺失",
    "The '%s' %s params missing with the %s params in the '%s'",
]);

define(1036,"INTERFACE_MEMBER_PARAMS_NOT_MATCHED",[
    "实现接口(%1)中，参数的类型不匹配",
    "The '%s' %s params type not matched with the %s params in the '%s3'",
]);

define(1037,"INTERFACE_MEMBER_GENERIC_PARAMS_NUM_INCONSISTENCY",[
    "实现接口(%1)中，泛型的数目不一致",
    "The '%s' %s declare generics number inconsistency in the '%s'",
]);

define(1038,"INTERFACE_MEMBER_GENERIC_NOT_SATISFY_CONSTRAINTS",[
    "实现接口(%1),泛型约束类型不匹配",
    "The '%s' %s generics does not satisfy constraint with the '%s'",
]);

define(1039,"INTERFACE_MEMBER_MODIFIER_NOT_CONSISTENT",[
    "实现接口(%1)中,访问命名空间的修饰符不一致",
    "the '%s' %s modifier is not consistent with the %s modifier in the '%1'",
]);

define(1040,"DECLARE_ALIAS_TYPE_NOT_ASSIGNMENT_VALUE",[
    "声明的别名类型(%s)必须指定一个类型值",
    "Declare '%s' alias type must assignment a type",
]);

define(1041,"MISSING_CONDITION",[
    "缺少条件",
    "Missing condition",
]);

define(1042,"LOOP_MAYBE_INFINITE_EXECUTE",[
    "循环语句体中缺少退出语句，可能会导致无限循环",
    "The absence of an exit statement in the body of a do while statement may result in an infinite loop",
]);

define(1043,"TOKEN_INVALID",[
    "无效的标识符",
    "Token(%s) invalid",
]);

define(1044,"PROPERTY_INITIAL_VALUE_NOT_NUMBER",[
    "枚举属性(%s)的初始值只能是数字或者字符串",
    "Enum property the '%s' initial value of can only is number or string",
]);

define(1045,"PROPERTY_REDEFINED",[
    "属性(%s)已经存在，不能重复定义",
    "Property the '%s' already exists. cannot redefined",
]);

define(1046,"REFS_VALUE_NOT_OBJECT",[
    "引用的值必须是对象",
    "The refs value of '%s' is not an object",
]);

define(1047,"LOOP_ONLY_SINGLE_VARIABLE",[
    "循环(%s)中只能声明单个变量",
    "Only a single variable declaration is allowed in a '%s' statement",
]);

define(1048,"LOOP_CANNOT_HAVE_INITIAL",[
    "循环(%s)声明的变量不能有初始值",
    "The variable declaration of a '%s' statement cannot have an initial",
]);

define(1049,"REFS_VALUE_MAYBE_NOT_OBJECT",[
    "引用的值可能不是对象值",
    "The refs value of '%s' maybe is not an object",
]);

define(1050,"PARAMETER_OPTION_ONLY_DECLARE_AFTER",[
    "带有初始值的参数(可选参数)只能跟在必填参数的后面",
    "The '%s' parameter with an initial value in method can only is declared after the parameter",
]);

define(1051,"PARAMETER_REST_MUST_AT_END",[
    "剩余参数只能在参数的结尾",
    "The '%s' rest parameter can only appear at the end of the params",
]);

define(1052,"CONSTRUCTOR_NOT_RETURN_VALUE",[
    "构造函数中不需要有返回值",
    "Constructor does not need to return value",
]);

define(1053,"CONSTRUCTOR_FIRST_CALL_SUPER",[
    "构造函数中必须先调用超类方法(super)",
    "Constructor must first call super",
]);

define(1054,"FUN_MUST_HAVE_RETURN_VALUE",[
    "函数声明的类型必须有返回值",
    "A function whose declared type is neither 'void' nor 'any' must return a value",
]);

define(1055,"FUN_ASYNC_MUST_RETURN_PROMISE",[
    "声明为异步的函数必须返回专有类型(%s)",
    "The return type of an async function or method must is the '%s' type",
]);

define(1056,"GENERIC_DECLARE_ALREADY_EXISTS",[
    "声明的泛型已经存在",
    "Generic '%s' is already exists",
]);

define(1057,"GENERIC_NAME_CONFLICTS_WITH_TYPE",[
    "声明的泛型与类型名冲突",
    "Generic '%s' conflicts with type name.",
]);

define(1058,"GENERIC_DECLARE_REQUIRED_PARAM_NOT_FOLLOW_OPTIONAL",[
    "声明泛型的参数，不能跟在可选参数的后面",
    "Required type parameters may not follow optional type parameters",
]);

define(1059,"REFS_TO_TYPE_NOT_USED_VALUE",[
    "当前的引用(%s)指向一个类型，不能当作值传递",
    "'%s' only refers to a type, but is being used as a value here.",
]);

define(1060,"REFS_IS_NOT_EXIST",[
    "引用(%s)不存在",
    "'%s' does not exist.",
]);

define(1061,"REFS_IS_NOT_ACCESSIBLE",[
    "引用(%s)不可访问",
    "'%s' is not accessible.",
]);

define(1062,"GENERIC_CANNOT_DECLARE_ON_CONSTRUCTOR",[
    "不能在构造函数上声明泛型",
    "Generic cannot is declared on constructor",
]);

define(1063,"METHOD_NOT_HAVE_OVERRIDE",[
    "类中成员方法(%1)在父类中不存在，不需要标记重写(@Override))注解符",
    "The '%s' %s does not exists in the superclass. remove the '@Override' annotator if not overwrite.",
]);

define(1064,"METHOD_NEED_HAVE_OVERRIDE",[
    "类中成员方法(%1)在父类中存在，需要标记重写(@Override)注解符",
    "the '%s' %s already exists in the superclass. use the '@Override' annotator if need overwrite",
]);

define(1065,"METHOD_GET_ACCESSOR_NOT_PARAM",[
    "获取访问器(%s)不需要声明参数",
    "'%s' getter does not defined param",
]);

define(1066,"METHOD_GET_ACCESSOR_NOT_PARAM",[
    "获取访问器(%s)需要返回值",
    "'%s' getter accessor must have a return value",
]);

define(1067,"METHOD_SET_ACCESSOR_NEED_PARAM",[
    "设置访问器(%s)需要声明一个参数",
    "'%s' setter must have one param",
]);

define(1068,"METHOD_ACCESSOR_TYPE_NOT_MATCHED",[
    "访问器(%s)的接收类型不匹配",
    "'%s' setter and getter parameter types do not match",
]);

define(1069,"NEW_IS_CANNOT_INSTANTIATED",[
    "当前引用(%s)不是一个可被实例化的类对象",
    "Reference the '%s' is not an instantiable class object",
]);

define(1070,"NEW_IS_ABSTRACT_CANNOT_INSTANTIATED",[
    "当前引用(%s)是一个抽象类，不能被实例化对象",
    "'%s' is an abstract class. cannot is instantiated.",
]);

define(1071,"REST_TYPE_NOT_MATCHED",[
    "剩余参数只能是一个元组类型",
    "Rest accept type must is tuple type",
]);

define(1072,"RETURN_MUST_FUN_BODY",[
    "返回表达式只能在函数体中",
    "Return expression must in function body",
]);

define(1073,"CONNOT_CONVERT_ARRAY",[
    "当前的引用不能转换为一个数组",
    "The '%s' cannot convert a reference to an array",
]);

define(1074,"CONNOT_CONVERT_OBJECT",[
    "当前的引用不能转换为一个对象",
    "The '%s' cannot convert a reference to an object",
]);

define(1075,"NOT_CALL_SUPER",[
    "调用超类(super)方法需要在子类中",
    "'super' no inherit parent class",
]);

define(1076,"SUPER_ONLY_IN_METHODS_CALLED",[
    "超类方法(super)只能在类方法中调用",
    "'super' can only is called in class methods",
]);

define(1077,"TUPLE_REST_MUST_FOLLOW_END",[
    "元组类型中声明的剩余类型只能出现在元素的结尾",
    "Tuple type rest parameter must follow the end",
]);

define(1078,"TYPE_DECLARE_ALREADY_EXISTS",[
    "声明的类型(%s)已经存在",
    "Declare type '%s' already exists",
]);

define(1079,"MISSING_TYPE_EXPRESSION",[
    "缺少类型引用",
    "Missing type expression",
]);

define(1080,"PROPERTY_NOT_EXISTS",[
    "属性名(%s)不存在",
    "Property '%s' is not exists",
]);

define(1081,"SPREAD_OBJECT_EXPRES_MUST_HAVE_INITIAL",[
    "展开对象表达式必须设置一个初始值",
    "Spread object expression, must have initial",
]);

define(1082,"PROPERTY_WITH_PARENT_MEMBER_CONFLICTS",[
    "当前属性(%s)与父类中的成员有冲突",
    "Property '%s' conflicts with a member of the parent class",
]);

define(1083,"TYPE_IS_NOT_EXISTS",[
    "引用的类型不存在",
    "Type '%s' is not exists",
]);

define(1084,"REQUIRED_PARAM_NOT_FOLLOW_OPTIONAL",[
    "声明的参数，不能跟在可选参数的后面",
    "Required parameters may not follow optional type parameters",
]);

define(1085,"ERROR",[
    "编译错误(%s)",
    "%s",
]);

define(1086,"SPECIFIES_TYPE_ARRAY_ELEMENT_NOT_SPECIFIED_INDEX_TYPE",[
    "指定类型为(%s)的数组元素，不能在数组索引位置指定类型",
    "Specifies an array element of '%s' type. the type cannot is specified at the array index",
]);

define(1087,"UPDATE_EXPRESSION_MUST_IS_NUMERIC",[
    "更新表达式(%s)的引用类型必须是一个数字类型",
    "The reference type of the update expression '%s' must is a numeric type",
]);

define(1088,"METHOD_NOT_HAVE_OVERRIDE",[
    "需要重写的方法(%s)参数数目不一致",
    "Inconsistent number of the '%s' method arguments to override",
]);

define(1089,"METHOD_NOT_HAVE_OVERRIDE",[
    "需要重写的存储器(%s)参数数目不一致",
    "Inconsistent number of the '%s' setter arguments to override",
]);

define(1090,"INTERFACE_MEMBER_INCONSISTENT_NUMBER_PARAMS",[
    "实现接口(%s)中的参数不兼容",
    "Implemented interface parameters is not compatible in the '%s' method",
]);

define(1091,"FRAGMENT_EXPRESSION_ERROR",[
    "片段表达式只能出现在结尾",
    "fragment expressions can only appear at the end",
]);

define(1092,"ANNOTATIONS_RUNTIME_METHOD_PARAM_INVALID",[
    "注解Runtime方法参数值只能是'server,client'",
    "Annotations runtime method parameters can only is 'server' or 'client'",
]);

define(1093,"ANNOTATIONS_LOCATION_INVALID",[
    "注解方法在此位置未生效",
    "Annotation method not in effect at this location",
]);

define(1094,"IMPORT_DECLAREATION_STATEMENT_INVALID",[
    "在此处声明的导入语无效",
    "The import declared here is invalid",
]);

define(1095,"LOAD_TYPE_DESCRIPTION_FILE_INVALID",[
    "指定加载的类型描述文件无效",
    "The type description file specified to load is invalid",
]);

define(1096,"FUN_GLOBALS_DECLARE_ALREADY_EXISTS",[
    "声明的全局函数(%s)已经存在",
    "Declare globals function '%s' already exists",
]);

define(1097,"PROP_GLOBALS_DECLARE_ALREADY_EXISTS",[
    "声明的属性(%s)已经存在",
    "Declare globals property '%s' already exists",
]);

define(1098,"XML_NAMESPACE_NOT_EXISTS",[
    "指定的XML命名空间(%s)没有定义",
    "The specified XML namespace '%s' is not defined",
]);

define(1099,"REFS_NAMESPACE_NOT_EXISTS",[
    "引用的命名空间不存在",
    "The '%s' namespace does not exist",
]);

define(1100,"EMBED_FILE_WAS_NOT_FOUND",[
    "嵌入的文件没有找到",
    "Embed file '%s' not found",
]);

define(1101,"EMBED_FILE_MISSING",[
    "缺失嵌入的文件",
    "Embed file missing",
]);

define(1102,"EMBED_ANNOTATIONS_ERROR",[
    "嵌入注解符只能定义在包或者顶级域中",
    "Embed annotations can only is defined in a package or top-level scope",
]);

define(1103,"ANNOTATIONS_ERROR",[
    "注解符(%s)只能定义在顶级域、包或者类中",
    "%s annotations can only is defined in a top-level scope or package or class",
]);

define(1104,"ANNOTATIONS_ERROR",[
    "注解符(%s)只能定义在方法或者属性上",
    "%s annotations can only is defined in a methods or property of class members",
]);

define(1105,"ANNOTATIONS_ERROR",[
    "注解符(%s)只能定义在类上",
    "%s annotations can only is defined in a class",
]);

define(1106,"EMBED_ANNOTATIONS_ASSETS_EXISTS",[
    "嵌入注解符指定的资源已经存在",
    "Embed annotations '%s' assets already exists",
]);

define(1107,"REFS_DECLARE_ALREADY_EXISTS",[
    "声明的引用(%s)已经存在",
    "Declare refs '%s' already exists",
]);

define(1108,"JSX_ELEMENT_MISSING_NAMESPACE",[
    "元素标签名不符合标准",
    "JSX element tag name does not is standard",
]);

define(1109,"JSX_SUBCLASS_PARENT_MUST_COMPONENTS",[
    "子类的父级必须是一个根元素组件",
    "JSX the parent of subclass must is root element components",
]);

define(1110,"JSX_Unsupported",[
    "不支持的代码块",
    "JSX Unsupported",
]);

define(1111,"COMPONENT_NOT_EXISTS",[
    "元素组件(%s)不存在",
    "Component '%s' is not exists",
]);

define(1112,"JSX_SUBCLASS_ALREADY_EXIST",[
    "在根元素组件中的子类已经存在",
    "JSX subclass already exist in the root element components",
]);

define(1113,"JSX_CAN_ONLY_AN_EXPRESSION",[
    "元素属性的子级只能是一个表达式",
    "JSX the value of element properties can only is a expression",
]);

define(1114,"JSX_ELEMENT_DIRECTIVE_INVALID",[
    "元素指令无效",
    "JSX element directive '%s' invalid",
]);

define(1115,"JSX_ROOT_ELEMENT_DIRECTIVE_INVALID",[
    "根元素上不能使用指令",
    "JSX directives cannot is used on the root element",
]);

define(1116,"JSX_ROOT_ELEMENT_DIRECTIVE_INVALID",[
    "元素指令(each)表达式错误, 正确写法是:'item of fromArray'",
    "JSX element directives 'each' expression error, correct be: 'item of fromArray'",
]);

define(1117,"XML_NAMESPACE_ONLY_DEFINE_AT_ROOT_ELEMENT",[
    "XML命名空间只能定义在根元素上",
    "JSX namespaces can only is defined on the root element",
]);

define(1118,"FILE_WAS_NOT_FOUND",[
    "没有找到指定的文件",
    "Not found the '%s'",
]);

define(1119,"JSX_DIRECTIVE_FOREACH_NOT_ARRAY",[
    "指令(EACH)的引用只能是一个数组. 当前为(%s)",
    "JSX references to the 'each' directive can only is an array. but got '%s'",
]);

define(1120,"JSX_DIRECTIVE_FOR_INVALID",[
    "指令(FOR)的引用类型必须是一个可迭代的对象",
    "JSX references to the 'for' directive must is an iterator object. but got '%s'",
]);

define(1121,"JSX_ROOT_ELEMENT_DIRECTIVE_FOR_INVALID",[
    "元素指令(for)表达式错误, 正确写法是:'value in fromIteration'",
    "JSX element directives 'for' expression error, correct be: '(value,key[optional],index[optional]) in fromIteration'",
]);

define(1122,"REQUIRE_IS_NOT_EXIST",[
    "加载依赖(%s)文件不存在。请先安装此依赖",
    "Require '%s' does not exist. try npm install %1",
]);

define(1123,"JSX_MULTIPLE_ELEMENTS_MUST_WRAPPED",[
    "多个元素必须包裹在一个容器中",
    "JSX Multiple elements must is wrapped in a container",
]);

define(1124,"MEMBER_PROPERTY_NAME_BE_RESERVED",[
    "'%s' 是一个被保留的标识符",
    "The '%s' is a reserved identifier",
]);

define(1125,"JSX_AVAILABLE_ELEMENTS_IN_SPECIFIED_NAMESPACE",[
    "指定的命名空间下可用元素为:%s",
    "JSX the '%s' available elements in the specified namespace",
]);

define(1126,"JSX_SLOT_IS_NOT_DEFINED_IN_PARENT_COMPONENT",[
    "引用插槽(%s)在父组件中没有定义",
    "JSX refs of the slot '%s' is not defined in the parent component",
]);

define(1127,"JSX_PARENT_OF_SLOT_IS_NOT_WEB_COMPONENT",[
    "插槽(%s)的父级不是一个web组件",
    "JSX parent of the slot '%s' is not web-component",
]);

define(1128,"JSX_SLOT_USED_PARAMS_IS_NOT_DEFINED",[
    "插槽(%s)使用的参数在父级组件的插槽中没有定义",
    "JSX the slot '%s' used parameters is not defined in the slot of the parent component",
]);

define(1129,"JSX_SLOT_IS_ALREADY_DEFINED",[
    "插槽(%s)已经定义过",
    "JSX the slot (%s) is already defined",
]);

define(1130,"JSX_SLOT_DOES_NOT_DECLARED_A_SCOPE",[
    "插槽(%s)没有声明作用域",
    "JSX the slot '%s' does not declared scope",
]);

define(1131,"JSX_COMPONENT_NOT_DEFINED_SLOTS_NEED_DELETE_DISCARD_CHILD_ELEMENTS",[
    "这些子级元素会被抛弃,可以在父级中指定默认插槽来接收这些元素或者删除",
    "JSX these child elements will discarded, can specify default slot in the parent to receive them. also is can removed them",
]);

define(1132,"REFERENCE_FILE_NOT_EXIST",[
    "引用的文件(%s)不存在",
    "References file '%s' does not exist",
]);

define(1133,"CONSTRUCTOR_NOT_RETURN_VALUE",[
    "缺少返回表达式",
    "Missing return expression",
]);

define(1134,"COMPONENT_MUST_INHERIT_WEB_COMPONENT",[
    "JSX 元素组件(%s)必须继承'web-component'",
    "JSX the '%s' element components must inherit 'web-component'",
]);

define(1135,"ANNOTATION_EXPRESSION_ARGUMENT_IS_INVALID",[
    "注解(%s)表达式参数无效",
    "The '%s' annotation expression arguments is invalid",
]);

define(1136,"ACCESSOR_CANNOT_OVERRIDE",[
    "成员属性(%s)不能被重写",
    "The '%s' members property cannot is overridden",
]);

define(1137,"MAIN_ENTER_METHOD_CAN_ONLY_SINGLE",[
    "注解符(%s)不能绑定多个入口方法",
    "Annotation the '%s' cannot bind multiple entry methods in an class",
]);

define(1138,"MAIN_ENTER_METHOD_CAN_ONLY_STATIC_AND_PUBLIC",[
    "注解符(%s)只能绑定在公开且为静态的方法上",
    "Annotation the '%s' can only is bound to public and static methods",
]);

define(1139,"PROPERTY_DYNAMIC_CAN_ONLY_IS_STRING",[
    "动态属性的索引(%s)类型只能是字符串或者数字类型",
    "The '%s' index type of dynamic property can only is string or number",
]);

define(1140,"ANNOTATION_IS_NOT_EXISTS",[
    "注解符(%s)不存在。可以在(compiler.options.annotations)中添加注解符",
    "Annotation the '%s' does not exist. but you can also register annotations through 'compiler.options.annotations'",
]);

define(1141,"TYPE_REFS_TO_CIRCULAR_DEPS",[
    "类型(%s)是一个循环引用",
    "Type '%s' refs to circular",
]);

define(1142,"TYPE_REFS_TO_CIRCULAR_DEPS",[
    "成员(%s)是一个只读属性",
    "The '%s' property is readonly",
]);

define(1143,"DIRECTIVE_CONTAINER_CAN_NO_LONGER_SET_DIRECTIVE_PROPERTY",[
    "容器指令不能再指定属性指令",
    "Directives container can no longer set attribute directive",
]);

define(1144,"DIRECTIVE_CONTAINER_MISSING_PARAMS",[
    "容器指令缺少属性",
    "Directives container missing attributes. expect '%s'",
]);

define(1145,"DIRECTIVE_CONTAINER_EXPECT_ATTRIBUTES",[
    "容器指令属性期望%s个,但设置了%1个",
    "Directives container attributes expect %s. but got %s",
]);

define(1146,"DIRECTIVE_CONTAINER_ATTRIBUTES_MUST_IS_EXPRESSION",[
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
    "缺少扩展对象属性(%s)",
    "Missing spread object property the '%s'.",
]);

define(1153,"",[
    "枚举成员必须具有初始化值",
    "Enum member must have initializer",
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
    "模块(%s)没有导出成员(%s),您是否打算使用\"import %2 from '%1'\"",
    "Module '%s' has no exported member '%s'. Did you mean to use \"import %2 from '%1'\" instead?",
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
    '表达式"%s"的引用,有被设置为专属作用域，在当前作用域中只能当类型引用',
    "Reference expression the '%s' was set proprietary plugin scope. so it can only be referenced as a type in the current doucument"
]);
module.exports = Diagnostic;