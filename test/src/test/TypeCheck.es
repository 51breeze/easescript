package test;

import test.Component;

public class TypeCheck<T>{

    start(){
        var dd:[int, uint, ...string ] = [1,1,"2222","66666","8888", true];
        this.test('address',{name36999:'Jun',age:33});
    }

    fetchApi(name:string, data:int, delay:int){
        return new Promise<[string,int]>((resolve,reject)=>{
            setTimeout(()=>{
                resolve([name,data, 1]);
            },delay);
        });
    }

    test<T>(type:string,{name36999,age}:{name36999:T,age:number}){
        return name36999;
    }

    test2<T>(type:T,[name:string,age:number]){
        return []
    }
  
}