package test;

class PromiseTest{

    start(){
        this.loadRemoteData2()
        const res = this.loadRemoteData()
        res.then((data)=>{}); 
        this.loadRemoteData3();  
        this.loadRemoteData4();
        this.list();
    } 

    fetchApi(name:string, data:number, delay:number){
        return new Promise<[string,number]>((resolve,reject)=>{
            setTimeout(()=>{
                resolve([name,data]);
            },delay);
        });
    }

    fetchApi2(name:string, data:array, delay:number){
        return new Promise<[string,array]>((resolve,reject)=>{
            setTimeout(()=>{
                resolve([name,data]);
            },delay);
        });
    }

    async loadRemoteData2(){
        return await this.fetchApi("one", 1, 800)
    }

    async loadRemoteData():Promise<[string,number][]>{
        var a = await this.fetchApi("one", 1, 800);
        var bs = await this.fetchApi("two", 2, 500)
        var c = await this.fetchApi("three", 3, 900)
        return [a,bs,c];
    }

    async loadRemoteData3(){
        var a = await this.fetchApi("one", 1, 800);
        var bs = await this.fetchApi("two", 2, 500)
        var c = await this.fetchApi("three", 3, 900)
        return [a,bs,c];
    }

    async loadRemoteData4(){
        var a = await this.fetchApi("one", 1, 800);
        var bs = {bs:await this.fetchApi("two", 2, 500)}
        var c = await this.fetchApi("three", 3, 900)
        var d = await this.fetchApi2("three", [3,6,'9'], 900)
        return [a,bs,c,d];
    }

    list(){
        return [1,'']
    }

    async loadRemoteData5():Promise<[string,number][]>{
        var a = await this.fetchApi("one", 1, 800);
        var bs = {
            bss: await this.fetchApi("two", 2, 500),
        }
        var c = await this.fetchApi("three", 3, 900);
        return [a,bs,c];
    }

}