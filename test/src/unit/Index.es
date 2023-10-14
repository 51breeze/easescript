package unit;

import unit.Param;

public class Index{

    constructor(opts:object){
        new Param();
    }

    start(){

        this.getListItems(this, ['start','getListItems'] )

        var obj = {
            start:this.start, 
           //getListItems:'this.getListItems',
           getList:this.getList,
           getListItems:this.getListItems
        };
        
        this.getListItems(obj, ['start','getList','getListItems'] )

        type FN = typeof this.getListItems;

        var b:FN = this.getList(obj, 'getListItems' );

        this.getListItems(obj,[])

        var objs = { start:'tartsss', name:'ssss' }
        this.getListObject(objs, 'start')
         this.getListObject(objs, 'name')

    }

    getListObject<T5 extends {start:string}, T6 extends keyof T5>(obj:T5, name:T6 ){
        return obj[name];
    }

    getList<T5, K6 extends keyof T5>(obj:T5, name:K6 ){
        return obj[ name ];
    }

    getListItems<T500, K600 extends keyof T500>(obj:T500,items:K600[]):T500[K600][]{

        var arr:('name'|'age')[] = ['name']

        arr.map( (name,index)=>arr[index] );

        function name<T, B extends {name:string}>(obj:T){
            return obj;
        }

        name( arr )

        return items.map( name=>obj[name] );

    }

}