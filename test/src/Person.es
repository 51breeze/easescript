package;

import com.TestInterface;
import Gen;

public class Person<T> extends Object implements com.TestInterface
{

    public var addressName:string = `the Person properyt "addressName"`;

    private var _name:string = '';

    private var _type:T = null;

    constructor( name:string ){
        super();
        this._name = name;
        var bsss:T9 = '';
        const b = new assert.AssertionError()
        process.exit()
    }

    get target(){
        return this;
    }

    public setType(a:T):T{
        this._type = a;
        return a;
    }

    public getType():T{
        return this._type;
    }

    public method( name:string, age:int):any
    {
        var str:string[] = ["a","1"];
        var b:[string, [string,int] ] = ["", ["1",1] ];

        var cc:[number] = [1];
        var x:[number,int,string,...object] = [1,1,'2222',{}];

        b.push( '1' )
        b.push( ['1',1] )

       var c:int = -1968;
       var bs:float = 22.366
       var bssd:number = -22.366
        this.target.address();
        this.target.avg<string, any>?.('')
        return "sssss";
    }


    public get name():string{
        return this._name;
    }

    public set name(val:string){
        this._name = val;
    }

    avg<T extends string,B>(a:T,b?:B):T{

        return a;
        
    }

    private address(){
        
    }

    protected addressNamesss(){

    }

    private tsnumer:number = null;

    test(){

        this.tsnumer = 1;

        return new Person<string>( 'this' );

    }

    gen(){

        var b = new Gen('name');
     //   var v:string = b.getType('1')
        var v1:string = b.getName('name');
        var v2:number = b.getAddress(1)

        var c = new Gen<number>(1);
        var d:number = c.getType(1)

        var f = new Gen(this);
        f.host.test().getType().substr(0)

    }

}

type T9 = string;


import vue from 'vue';
declare interface It{
    
}