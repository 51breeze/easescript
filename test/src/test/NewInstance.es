package test;

import test.Component;

public class NewInstance<T> extends Component< NewInstance<number> >{

    start(){
         this.getInstance();
         this.getInstance().genTypeClass;
         new (this.getInstance().genTypeClass)();
         this.skinClass;

         var classType = typeClass<array>();
         new classType();
         (new classType()).genTypeClass;
         var b = new classType();
         b.getType([1])

         var c = new NewInstance<boolean>();
         c.getType( !0 )

         b.getType([1]).push('')

        this.concat('111');

        this.ts({
            name:'11',
        })

       
        this.tss({
            name:true,
        }) 

        this.tsss('sss', '111')  //15

        const set = new Set([1,3,this]);

        var bsd =  this.tsss('s', 111);
        bsd = 'sss'

        var classNumType = typeClass<number[]>();
        var bc = new classNumType();
        bc.getType([1]).push('') //21

    }

    getInstance(){
         var target = new (this.getClass())(); 
         return target;
    }

    var target:class< NewInstance<string> > =  NewInstance;

    getClass(){
       return this.target;
    }

    var _genTypeClass:class< NewInstance<T> >;

    get genTypeClass(){
        if( !_genTypeClass ){
            _genTypeClass = NewInstance;
        }
        return _genTypeClass;
    }

    typeClass<T>(){
        return NewInstance as class< NewInstance<T> >;
    }

    getType(obj:T){
        return obj;
    }

    concat( name:AddressReferenceType<string> ){
        return name;
    }

    ts(o:OType<string> ){
        return o;
    }

    tss<T99>(o:OType<T99>){
        return o;
    }

     tsss(o:AddressReferenceType<string> , b:AddressReferenceType<number> ){
        return o;
    }

    newProxy(){
        const proxy = {};
        const store = new Proxy(proxy, {
            set:(target,key,value)=>{
               
            }
        });
        return store;
    }

    assignment(){
        let conf:ProxyHandler<{}> = {
            set:(target,key,value)=>{

            }
        }
        conf = {
            get:(target,key,value)=>{

            }
        }
        return conf;
    }


    arrayType(){
        let conf:ProxyHandler<{}>[] = [{
            set:(target,key,value)=>{
               
            }
        }]

        conf.push({
            get:(target,key,value)=>{

            }
        })
        return conf;
    }

}