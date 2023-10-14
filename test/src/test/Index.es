package test;

public class Index{

    constructor(opts:object){
        var test:({name:string})[] = []; 
    }

    start(){

        this.getListItems(this, ['start','getListItems'] )

        var obj = {
            start:this.start, 
           getList:this.getList,
           getListItems:this.getListItems
        };
        
        this.getListItems(obj, ['start','getList','getListItems'] )

        type FN = typeof this.getListItems;

        var b:FN = this.getList(obj, 'getListItems' );

        this.getList(obj, 'getListItems222' );

        var bss = [1,'sss'];
        let [error, result] = bss;
        [error, result] = bss;

        var bssc = {}
        let {name, age} = bssc;

        const checked = (this._checkedCagegories||[]).map( item=>String(item.id) );

        const dyn:{[key:string]:any} = {};

        dyn.test = 1;
        dyn.name

    }

    private _checkedCagegories:{id:number,name:string}[] = [];

    getListObject<T5 extends {start:string}, T6 extends keyof T5>(objs:T5, name:T6 ){
        return objs[name];
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