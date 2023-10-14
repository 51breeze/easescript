package test;

import test.Component;

public class InferReturn{

    start(){
        this.list();
        this.items();
        this.filter(1)
    }

    list(){
        const group:{[key:string]:string} = {};
        return Object.keys( group ).map( name=>{
            return {
                name:name,
                count:1,
            }
        });
    }

    items(){
        return [
            {
                name:'sss',
                age:20,
                address:''
            },
            {
                name:'sss',
                age:20,
                nickname:'ssss',
                flag:false
            }
        ]
    }

    filter( flag:number ){
        if( flag ==1 ){
            return {name:'zh'}
        }else if( flag==2 ){
            return {age:30, name:'222'}
        }
        return null;
    }
}