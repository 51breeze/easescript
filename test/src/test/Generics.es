package test;

class Generics<TD extends string = string>{

    start(){
        const map = new Map()
        map.set(1,1)

        const map2 = new Map([[1,1]])
        map2.set(1,1)
        map2.set(1,'sss')

        const map3 = new Map<number, string>()
        map3.set(1,'1')
        map3.set(1,true)
    
    }

    testCallArray(){
        const a1 = Array(10)
        a1.push(1,2,3,'ok',true)

        const a2 = Array(1,2)
        a2.push(1)
        a2.push('error') //error

        const a3 = Array(1, '2', true)
        a3.push(1,'2',false)
        a3.push([]) //error

        const a4 = Array<string>('1', '2')
        a4.push('2')
        a4.push({}) //error

        const a5 = Array<{}>()
        a5.push({})

    }

    testNewArray(){
        const a1 = new Array(10)
        a1.push(1,2,3,'ok',true)

        const a2 = new Array(1,2)
        a2.push(1)
        a2.push('error') //error

        const a3 = new Array(1, '2', true)
        a3.push(1,'2',false)
        a3.push({}) //error

        const a4 = new Array<string>('1', '2')
        a4.push('2')
        a4.push(false) //error

        const a5 = new Array<{}>()
        a5.push({})
    }

    testStaticArray(){
        var bs = [1]
        bs.push(1)
        Array.from( bs , (v, k)=>{
            const b = v[0]
            b.toFixed(2)
            return String(b)
        })
        Array.of(bs)
        String('')
    }

    testRecord(){
        const bo:Record = {}
        bo.name = 123

        const b1:Record<number> = {}
        b1.phone = 123;
        b1.name = 'zh';
        const v2 = b1.phone;

        const b2:Record<string, number> = {}
        b2.phone = 123;
        b2[9899] = 'zh';
        const v3 = b2[9899];

    }

    testArrayMap(layouts:{key:string,children:any[]}[]){
        return layouts.map( (item)=>{
            return item.key
        })
    }

    testArrayFilter(){
        [].filter( Boolean )
    }

    testPredicate(name){
        const ds = this.isTest(name);
        if(this.isTest(name)){
            const bs = name;
            console.log( bs.slice(0), ds )
        }

        const age = {old:30};
        if(this.isTest2(age)){
            const bs = age;
            console.log( bs.old )
        }

        if(this.isTest3(age, 'old')){
            const bs = age;
            console.log( bs.toFixed() )
        }

        const v = this.isTest3(age, 'old');
        if(v){
            const bs:uint = age;
        }

        const vs = this.isTest3(age, 'old');
        if(ds){
            const bs:uint = age.old;
        }
        
        const v2:(string | typeof age) = vs ? age.toFixed() : age;

    }

    isTest(obj):obj is string{
        return true;
    }

     isTest2<T>(obj:T):obj is T{
        return true;
    }

    isTest3<T, K extends keyof T>(obj:T, prop:K):obj is T[K]{
        return true;
    }

     static private services:annotation.ReadfileResult;

    setup(editor){
       services.map( async(item)=>{
           
        });
    }

}