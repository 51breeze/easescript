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

}