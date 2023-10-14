package unit;

public class Param{


    start(){

        enum en {
            name1000=6,
            age=7
        };

        enum t {
            name='A',
            A='c',
        }

        var b:en = en.age;
        this.getList(en ,  [9,5]);
        this.ave(2.3660);
    }

    getList<T,B>({name1000,age}:{name1000:T,age:number},[index:T,id]){

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