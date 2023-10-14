package test;

public class ForOf<T=any> implements Iterator<T>{

    start(){

        for(let item of this){}

        var list = ['1','2',3];
        for( let item1 of list ){}

        var props = {
            'name':'name',
            'age':35
        }

        for( let item2 of props ){}

        for( let item3 of 'abcdef' ){}

        var target = new ForOf<string>();

        for( let item4 of target ){
            var b = item4;
        }

        target.next();

        var map = new Map<string, ForOf<string> >();
        map.set('one', this as ForOf<string> );
        map.set('two', target );

        for( let item5 of  map.entries() );
        for( let item6 of  map.values() );
        for( let item7 of  Array.from( map.values() ) ); //14

        map.values().next();
        for(let item8 of this.getInstance()){}
        for(let item9 of this.getInstance().target){}

        var bs = [1]

        bs.push(1)

        const bsd = Array.from(bs)

        Array.from( bs , (v, k)=>String(v) );

        Array.of(bs)

        this.next();
        
    }

    getInstance(){
         var target = new ForOf<array>(); 
         var map={
             target,
             name:'name'
         } 
         return map;
    }

    private count = 0;

    next(){
        if( this.count > 5 ){
            return {
                value:null,
                done:true,
            }
        }
        return {
            value:this.count++,
            done:false,
        }
    }

    rewind(){
        this.count = 0;
    }

}