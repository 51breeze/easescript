/**
* Test a test package
*/

package;


/**
* Test a class
*/
public class Promist{

    testAwait(){
         
        const result1 = this.loadRemoteData(1);
        //const result2= await this.loadRemoteData(2,'', done);
        result1.then((data)=>{
                console.log( data, "============" );
        });
        
    }

    fetchApi(name, data, delay ){
        return new Promise((resolve,reject)=>{
            //console.log( name,"===Promise===" )
            setTimeout(()=>{
                resolve([name,data])
            },delay as number);
        });
    }

    async loadRemoteData( type ):Promise<any>{

        var a = await this.fetchApi("one", 1, 3000);

        var b = await this.fetchApi("two", 2, 500);
        return [a,b]
    }

    getApi(i,b){
        return new Promise((resolve,reject)=>{
            setTimeout(()=>{
                    console.log(i,b)
                    resolve([i,b])
            },i as number)
        })
    }


    async add():Promise<any>{

        var bs = {
            bss: await this.getApi(4000,1)
        }

        var bsss = await this.getApi(500,2);
        return [bsss,bs];
    }


}
  
import Promist;
const test = new Promist();


test.testAwait();

const result1 = test.loadRemoteData(1);
//const result2= await this.loadRemoteData(2,'', done);
result1.then((data)=>{
        console.log( data, "============" );
});

const res = test.add()
res.then( (data)=>{
  console.log( data );
}) ;




