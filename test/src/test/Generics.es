package test;

class Generics{

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

}