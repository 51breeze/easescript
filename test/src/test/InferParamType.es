package test;

import test.Component;

public class InferParamType{

    start(){
        this.deep({
            success(res){
                console.log( res )
            },
            header:{
                contentType(res){
                    console.log( res )
                }
            },
            fail(err){
                 console.log( err )
            }
        });

        this.call((item)=>{

        })

        this.getInfo({
            success:(result)=>{
                
            },
        })

        this.with({
            image:(que369)=>{
               console.log( que369 )
            }
        })

        this.arr()
    }

    deep(object:RequestOptions){
        return object;
    }

    call(callback:(item:string)=>void){
        return callback('name');
    }

    getInfo(ops:AsyncRequestOptions<RequestOptions,ChooseImageSuccessCallbackResult,any>){

    }

    with(withs:string|Record<(query?:this)=>any>){
        return this;
    }

    arr(){
        return Object.keys({}).reduce((computedGetters, name) => {
            return computedGetters;
        }, {})
    }
}