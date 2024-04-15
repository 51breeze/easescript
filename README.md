# EaseScript

**EaseScript 是一个类型推导脚本编译器，目的是用ES6的语法编译成多个不同运行环境的脚本语言。**

**EaseScript 将通用的WEB技术栈集成在一起按需构建打包，使用时开箱即用无需过多配置。在与后端API交互中直接实现互通无需中间请求配置， 用ES6语法便可完成前后端的所有工作。 为开发者提供了一个愉悦的开发方式**

## 快速开始
  1、安装VSCode扩展插件 
    
    打开VSCode编辑器并在扩展面板输入 "EaseScript" 选择并安装此扩展来支持语法高亮和类型提示。 目前仅支持 VSCode

  2、进入控制台并输入以下命令

  ```js
  npm install es-installer -g
  ```

  安装成功后在控制台输入 `esi --init` 按提示操作即可

## 语法
语法文档，请参照 https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference  

### 1、不支持的语法：
yield, yield* 和生成器函数

### 2、暂不支持的运算符：
.?(可选链运算符), ??(空值合并运算符), ??=(逻辑空赋值)

### 3、语法关键字（没有列举出来的表示与ES6一致）

**package：声明命名空间，定义在文档的开头**

语法：_package [标识符]; 如果不指定标识符则为全局。_

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

语法:_protected 标识符[:type] [=初始值]_

 ```ts
public name:string;
```

**protected 修饰符，定义成员属性为保护，对外不可访问，子类可访问**

 语法:_protected 标识符[:type] [=初始值]_
 
  ```ts
protected name:string;
```

**private 修饰符，定义成员属性为私有，对外不可访问, 本类中可访问**

语法:_private 标识符[:type] [=初始值]_

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

语法：_[public] class [标识符] [extends 标识符] [implements 标识符, ... ]_

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

语法：_typeof 表达式_

```ts
typeof this.name === ‘string’
type T1 = typeof this.name; //将表达式类型定义给T1
```
**type: 类型声明，方便在代码块中引用类型，或者是将复杂类型简单化，又称为缩短类型。类型声明后只当类型引用不会被构建在代码中。**
type 关键字的定义只能出现在块级域中

语法：_type 标识符 = 引用类型;_

```ts
type T1 = string;
type T1 = typeof this.name; //从一个表达式中引用类型
const name:T1 = zs;
```

### 3、注解符
注解符是在编译阶段根据不同的指令调整、修改、注入不同的代码块，以达到快速开发的目的。

注解符分为：表达式注解符、声明式注解符和编译宏注解符

***声明式注解符：***
Provider,Callable,Runtime,Syntax,Env,Router,Post,Get,Delete,Put,Option,Deprecated,Define,Internal,Alias,Override,Dynamic,Embed,SkinClass,Abstract,WebComponent,HostComponent,Require,Required,Import,Main,Reference,
DOMAttribute,Injector,Reactive,Hook

**Runtime,Syntax,Env: 编译时注解符**

主要是在编译时如何构建代码。暂未实现

**Router,Post,Get,Delete,Put,Option:路由注解符**
主要配置在服务端类成员的方法上，Router, 是其它路由注解符的实现, Post,Get,Delete,Put,Option 对应的是路由接收的请求方法。
如果要使用 Router 来定义路由：@Router('/path', method=post), method默认为get; 

语法：_@Post([path])。 Get,Delete,Put,Option 语法相同_

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

语法：_@Embed([path])_

```ts
package com.views;
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

语法：_@Define(符号类型,  值， 参数)_

```ts
package com.views;
import web.components.Component
@Define(slot, title,  scope:{name:string}) //给当前组件定义插槽属性, 在编译阶段能正确引用
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
Provider,DOMAttribute,Injector,Reactive,Hook,Alias, Required 用于前端组件。DOMAttribute, Hook, Alias, Required 不常用，主要是在编写类型描述时对成员属性的一个补充。


语法：_@Define(符号类型,  值， 参数)_

```ts
package com.views;
import web.components.Component
class HomePage extends Component{

  @Injector //从父组件中注入app对象的引用
  private app:App;

  @Reactive //一个有着响应式的属性引用
  private list=[]

  @Provider //提供一组数据，在子组件中引用. 提供者的修饰符必须为public
  public data(){
    return {name:'HomePage'};
  }
}
```

**Require(已弃用, 使用import代替), Import(已弃用, 使用import代替), Reference(引用类型文档):资源引用注解符**
语法：_@Reference(filepath)_

**Override, Abstract, Internal, Main, Callable, Dynamic:修饰符注解符**
Internal, Main, Callable, Dynamic, 用于在编写类型描述时对成员属性的一个补充

语法：_@Override_

```ts
package com.views;
import web.components.Component

@Abstract // 此类不能被直接实例化, 需要通过子类继承
class HomePage extends Component{

  @Main //为此类添加一个直接调用的入口，在这个类被加载时执行。此注解符绑定的方法必须为静态公开方法。 通过利用这个做一些初始化的工作，当然一般用于入口文件中，比如 App;
  static main(){
    //to do...
  }

  @Override //对父方法的覆盖
  render(){
    //...
  }
}
```

***表达式注解符：***

Router,Http

**Router:生成一个路由对象**
主要用于生成一个前端页面的路由对象

语法：_@Router(className, [[param=]params])_

```ts
package views;
import web.components.Component
class Home extends Component{
  @Override
  render(){
    const params = {
      id:5
    }
	  const route = @Router(views.HomePage, params);
  }
```

**Http:发送Http 请求**
主要用于在前端页面向后端请求数据

语法：_@Http(className, methodName, [[param=]param], [[data=]data], [[options=]options] )_

```ts
package views;
import web.components.Component
class Home extends Component{

  async loadData(){
    const params = {
      id:5
    }
    const data = await @Http(com.api.Person, list, params)
  }
}
```

***编译宏注解符：***

Runtime,Syntax,Env,Version,

语法：_@Runtime(platform)_ //client, server;

语法：_@Syntax(PluginName)_ //es-vue, es-php,...

语法：_@Env(propName, value)_

语法：_@Version(PluginName, value, operator)_ // operator: egt,elt,neq,gt,lt,eq

```ts
package;
import web.components.Appliction;
class App extends Appliction{
  @Main
  static main(){
    when( Env(NODE_ENV, development) ){
        //如果当前为开模式
        System.setConfig('http.request.baseURL', '/api');
    }then{
        //生产模式
        System.setConfig('http.request.baseURL', '/'); 
    }
  }
}
```