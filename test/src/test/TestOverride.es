package test;

class TestOverride{

    start(){

        const over =  new Override();
        const add1:string[] = over.add('person');
        const add2:{name:string,age:int}[] = over.add('person', 3);
        const add3:number = over.add('name',1);

        const p1:string = over.push('ss');
        const p2:string[] = over.push<string[]>(['name'],1);
        const p3:number[] = over.push<number>(1,1,true);
        const p4:number[] = over.push(1,1,true);


        const p5:string = testOveride('ss');
        const p6:{name:string,age:number} = testOveride('ss', 66);
        const p7:boolean = testOveride<string>('ss', 66);

         const p8:1 = testOveride(1);
         const p9:'string123'= testOveride('string123');

    }

}