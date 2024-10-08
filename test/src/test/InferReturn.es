package test;

import test.Component;

public class InferReturn{

    start(){
        this.list();
        this.items();
        this.filter(1)
        this.getRest()
        this.success({})
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

    getRest(){
        if(1){
            return 'name'
        }else{
            if(2){
                return 1
            }else{
                if(9){
                    return true
                }else{
                    return false;
                }
            }
        }
    }

    getVoid(){
        if(1){
            return 'name'
        }
    }

    success<T>(data:T, code:number=200, msg:string='ok'){
        return json({data, code, msg}, 200)
    }
}