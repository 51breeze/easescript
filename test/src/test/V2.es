package test;

import test.Component;

public class V2<TV>{

    constructor(name:TV){
        
    }

    start(){
        this.test('address',{name:'Jun'})
        this.test1('address',[123])
        this.test2([123])
        this.test3({key:'sss'})
        this.test4({key:{name:{age:12}}})
        this.test5({name:'ssss',age:35})
        this.test6({name:'ssss',age:35}, 'age')
        this.test6({name:'ssss',age:35}, 'name')
        this.test7({name:'ssss'})
        this.test7({name:33})
        this.test7({name:'ssss'}).name
        this.test6(this, 'test');

        // 12
        const arr:number[] = [1];
        arr.unshift();
        arr.push(1);
        arr.forEach( item=>{});
        arr.some(item=>!!item);

        const obj = new V2('ssss');
        obj.type('sss');

        //alias type
        const alias:AddressReferenceType<string> = 'ssss';
        alias.includes('ssss')
        const alias1:OType<string> = {name:'ssss'}

        //should error test
        this.test7<string>({name:33})
        this.test6({name:'ssss',age:35}, 'ages')
        arr.push('sss');
        obj.type(true);
        const alias9:OType<string> = {name:123}
        const alias10:OType<number> = alias1


        const [d1, d2] = arr;
        const dd3 = [];
        let [d22, d23]:[number, string] = dd3;

        const obj6 = {name:'sss', age:20};

        let {name,age:age2}:{name:string, age:number} = obj6;

        d23 = 'ssss'
        age2 = 666;
      
    }

    test<T>(type:string,{name}:{name:T}){
        return name;
    }

    test1<T>(type:string,[name]:[T]){
        return name;
    }

    test2<T>(type:T){
        return type;
    }

    test3<T>(type:{key:T}){
        return type;
    }

    test4<T>(type:{key:{name:{age:T}}}){
        return type;
    }

    test5<T extends {name:string,age:number}>(type:T){
        return type;
    }

    test6<T1, K1 extends keyof T1>(t:T1,k:K1){
        return t[k]
    }

    test7<T2>(data:{name:T2}){
        return {
            name:data.name,
            age:30
        }
    }

    type(name:TV){
        return name;
    }

  
}