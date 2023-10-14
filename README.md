# EaseScript

easescript 是一个类型脚本编译语言，目的是用ES6的语法编译成多个不同目标的脚本语言，来减轻开发者的学习成本和工作量。它与 typescript 类似，同样具有类型推导来约束代码但有着不同的语言特性。

## 一、语法
语法文档，请参照 https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference  

### 1、不支持的语法：
yield, yield* 和生成器函数

### 2、暂不支持的运算符：
.?(可选链运算符), ??(空值合并运算符), ??=(逻辑空赋值)

### 3、语法关键字（没有列举出来的表示与ES6一致）

**package：声明命名空间，定义在文档的开头**

语法：

_package [标识符]; 如果不指定标识符则为全局。_

行内声明：

```ts
package com;
class Person{
}
```

块级声明：

```ts
package com{
   class Person{
   }
}
```

以上两种方式都是声明了在 com 空间中定义的 Person 类  

**public 修饰符，定义类或者成员属性为公开。默认类或者成员属性为public**

语法:

_语法protected 标识符[:type] [=初始值]_

 ```ts
public name:string;
```

**protected 修饰符，定义成员属性为保护，对外不可访问，子类可访问**

 语法:
 
 _protected 标识符[:type] [=初始值]_
 
  ```ts
protected name:string;
```

**private 修饰符，定义成员属性为私有，对外不可访问, 本类中可访问**

语法:

_private 标识符[:type] [=初始值]_

```ts
private name:string;
```

**import 导入类, 或者导入资源文件（.js, .css）**

语法：

_import 标识符_

```ts
import com.Person //导入 Person 类
import “index.css” //导入index.css 文件
import * as V from “vue” //导入vue 到 V 的变量中
import {ref} from “vue” //导入vue 中的ref
```

**class  定义类**

语法：

_[public] class [标识符] [extends 标识符] [implements 标识符, ... ]_

```ts
class Person extends Human implements IWorker,IHappy{
  name:string
  protected address:string
  private phone:number
  constructor(name:string){
      this.name=name;
      this.phone = 123456789;
      this.address = "sh";
  }
}
```
**typeof: 获取表达式的类型，可以与type 配合使用**

语法：

_typeof 表达式_

```ts
typeof this.name === ‘string’
type T1 = typeof this.name; //将表达式类型定义给T1
```
**type: 类型声明，方便在代码块中引用类型，或者是将复杂类型简单化，又称为缩短类型。类型声明后只当类型引用不会被构建在代码中。**
type 关键字的定义只能出现在块级域中

语法：

_type 标识符 = 引用类型;_

```ts
type T1 = string;
type T1 = typeof this.name; //从一个表达式中引用类型
const name:T1 = zs;
```

### 3、注解符
注解符是在编译阶段根据不同的指令调整、修改、注入不同的代码块，以达到快速开发的目的。

注解符分为：表达式注解符和声明式注解符

声明式注解符：
Provider,Callable,Runtime,Syntax,Env,Router,Post,Get,Delete,Put,Option,Deprecated,Define,Internal,Alias,Override,Dynamic,Embed,SkinClass,Abstract,WebComponent,HostComponent,Require,Required,Import,Main,Reference,
DOMAttribute,Injector,Reactive,Hook

**Runtime,Syntax,Env: 编译时注解符**

主要是在编译时如何构建代码。暂未实现

**Router,Post,Get,Delete,Put,Option:路由注解符**
主要配置在服务端类成员的方法上，Router, 是其它路由注解符的实现, Post,Get,Delete,Put,Option 对应的是路由接收的请求方法。
如果要使用 Router 来定义路由：@Router('/path', method=post), method默认为get; 

语法：
_@Post([path])。 Get,Delete,Put,Option 语法相同_

```ts
package com.api;
class Person{
  @Post('/list')
  list(id?){
	return [1,2]
  }

```
在构建后的代码中会自动生成路由文件, 路由规则为:/list/<id?>, 对应的文件为 com.api.Person::list。


**Embed:嵌入图片注解符**
主要用在成员属性上注入图片的引用, 一般用于前端

_@Embed([path])_

```ts
package com.api;
import web.components.Component
class HomePage extends Component{
  @Embed('./logo.png')
  private logo:string;
  
  @Override
  render(){
	 return <img src={logo} />
  }
```

**Define,WebComponent,SkinClass:文档类型注解符**
定义文档的类型，这个主要在编译阶段配合插件选项来构建代码

语法：
_@Define(符号类型,  值， 参数)_

```ts
package com.api;
import web.components.Component
@Define(slot, title,  scope:{name:string})
class HomePage extends Component{
}
/*
<HomePage>
<slot:title>
	<div>title content</div>
</slot:title>
</HomePage>*/
```

**Provider,DOMAttribute,Injector,Reactive,Hook,Alias, Required, HostComponent:成员属性注解符**

**Require(已弃用, 使用import代替), Import(已弃用, 使用import代替), Reference(引用类型文档):资源引用注解符**

**Override, Abstract, Internal, Main, Callable, Dynamic:修饰符注解符**
