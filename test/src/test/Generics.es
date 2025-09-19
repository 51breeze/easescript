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
            const b = v
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

    createReadfileTree<T=Record>(result:annotation.ReadfileResult){

        const tree:Map<string, T> = new Map();

        const ss = [...tree]
        console.log(ss)
      
        return Array.from(tree.values());

    }

    testTypeConditional(){
       const result1 = this.testTypeConditionalCall([1])
       const result2 = this.testTypeConditionalCall([''])
       const result3 = this.testFlat([['']]);
       const result4 = this.testFlat([[[1]]], 2);
       const result5 = this.testFlat([[[1]]], 1);
    }

    testTypeConditionalCall<K extends Array<any>>(item:K):ExtractItem<K>{
        return item[0]
    }

    testFlat<A, D extends number=1>(arr:A,depth?:D):FlatArray<A, D>[]{
        return arr
    }

    testFlatThis<A extends any[], D extends number=1>(this:A,depth?:D):FlatArray<A, D>[]{
        return [1]
    }

    testFlatArr(){
        let items:{name:string}[] = []
        const result = items.map(item=>{
            return [item];
        }).flat().sort((a,b)=>{
            return a.name - b.name
        })

        items = result
    }

     testComputedArr(){
        let items93685:(string|number)[] = [];
        return items93685[0];
    }

    testIsArray(){
        let items93690:string | number[] = [];
        if( Array.isArray(items93690) ){
            items93690.push(1)
        }
    }

    testArrayFrom(){
        const bs9865:string[] = ['1'];
        Array.from(bs9865)

        const bs9866:Map<string, number> = new Map();
        Array.from(bs9866)

        const bs9867 = [1];
        Array.from(bs9867)
    }

    testInferWrapType(){
        watch((q)=>1, (newValue)=>{

        })
        //ss
    }

}

declare type ExtractItem<K> = K extends infer P[] ? P extends string ? string[] : number : unknown;


declare type FlatArray<Arr, Depth extends number> = {
    done: Arr;
    recur: Arr extends Array<infer InnerArr> ? FlatArray<InnerArr, [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20][Depth]>
        : Arr;
}[Depth extends -1 ? "done" : "recur"];