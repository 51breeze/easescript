
struct table admin{
  id: int(11) not null  AUTO_INCREMENT,
  account?: varchar(32) not null DEFAULT '1',

  PRIMARY KEY(id),
  KEY pid(id),
  UNIQUE KEY pidid(id) USING HASH COMMENT '66666666',
  FULLTEXT KEY title(account)
} ENGINE=MyISAM AUTO_INCREMENT=4 DEFAULT CHARSET=utf8;


class Index{

    use static extends Array<any>:class:public{
        find(data?:TestAlisType):any
        [key:string]<T=string>():T
    }

    constructor(){
        this.concat('111');
        this.ts({name:'11'})
        callmethod();
        new callmethod();
    }

    concat( name:AddressReferenceType<string> ){
        const t = 'ss' | 'as' | 'is';
    }

    ts<T>(o:OType<T>){

    }

    start(){

        const callback:Function = ()=>1;
        callback();

        console.log("===Hello word====");
        @Provider( className=com.Person, 'fetch', 'get' );

        Index.find(1);


        type T988 = number[];
        const list999:T988 = [];
        const group:{[key:string]:T988} = {};
        list999.forEach( (item:number)=>{
            const target = group[item] as RMD<T988>;
            if( target ){
                target.push( item );
            }else{
                group[item] = [item];
            }
        });
  

        type Item = {
            name:string,
            item:Item
        }

        var bb:Item ={
            name:'name',
            item:bb
        }

        type T = Array<any> & Index;

        var bd:T = this as T;

        
        const p998 = this as Objecter<{children:[]}>;
        p998.children = [];

        // var o999 = {
        //     name:'ssss',
        //     item:
        // };

        type T99 = typeof bb;
        var dsss = bb as Objecter<T99>;

        dsss.name;


        console.log(  1 );

        const list = [
            1,
            []
        ];
        const map988:ArrayMappingType< RMD<array> > = {};
        for(let item:RMD<array> of list){
            const id = item['id'] as string;
            map988[ id ] = item;
        }

        var bds:RMD<Index> = this;


        var bs = {name:'sss', age:1};
        var dd99999 = {name:'1', ...bs};

        var dssss = [ ...list ]

        var dbss = [1, true];
        dbss = [1]

        const [total, inserts] = this.synchData();

        const listItems = this.getUnionType();
        const s:string = listItems.name



    }

    private synchData(){
        const list = [];
        const total:int = 25;
        return [list.length, total];
    }

    getUnionType(){
        const list:{name:string, age:number} = {name:`ssss`, age:1};
        return list || {name:"sss"}
    }


}