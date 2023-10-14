package test;

class MergeTypes{

    start(){
       this.list();
    } 

    list(){
        var a = ['a','b',[1,['aaa']],1]
        var c = {
            s:a,
            d:{
                a:'a',
                b:'c',
                d:'d',
                e:a,
                f:{
                    a:'fa',
                    b:'fb',
                    c:{
                        a:'fca'
                    }
                }
            }
        }
        var b = {
            a:[c,c,a],
            c:'c',
            d:'d',
            e:1
        };
        return b;
    }
}