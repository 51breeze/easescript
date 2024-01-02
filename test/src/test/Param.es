package test;

public class Param{


    start(){
        this.express({name:'ssss',type:1})


        const config:{
            get:(target:string)=>void,
            items:[(target:string)=>void,{
                get:(target:string)=>number
            }]
        }[] = [
            {
                get(target){

                },
                items:[
                    (target)=>{

                    },
                    {
                        get(target){
                            return 1;
                        }
                    }
                ]
            }
        ];

        const config1:{
            get:(target:string)=>void,
            items:[(target:string)=>void,{
                get:(target:string)=>number
            }]
        } = {
                get(target){

                },
                items:[
                    (target)=>{

                    },
                    {
                        get(target){
                            return 1;
                        }
                    }
                ]
            }

        type T1 = (target:string)=>number;
        let config2:T1= null;
        config2 = (target)=>{
            return 1;
        }


        this.express('sss')
        this.express({name:'ssss'})
        this.onActions(({name,age})=>{

        });
    }

    onAction(callback:(options:{name:string,type:number})=>void){
        return callback({name:'zs',type:1})
    }

    onActions(callback:(options:{name:string,type:number,[key:string]:any})=>void){
        return callback({name:'zs',type:1})
    }

    express<T>({name,type}:{name:T,type:number}){
        return name
    }

    getList<T,B>({name1000:T,age:number},[index:T,id]){

        console.log( name1000, age ,index, id );

         var args = [index, age];

         this.call( ...args );

        console.log( ...args )

        return name1000;
       
    }

    ave<T>(age:T){

        return age;

    }

    call<T>(i,b:T){

        return b;

    }
}