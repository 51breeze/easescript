const compiler = require("../compiler");

function getExpression(body, at){
    return body[at].expression;
}

function getDeclarator(body, at){
    return body[at].declarations[0];
}

function fromat(str){
    return str.replace(/[\s\r\n]/g,'')
}

function getExpString( body, pos ){
    return fromat( getExpression(body,pos).type().toString() );
}

function getDeclString( body, pos ){
    const exp = getDeclarator(body,pos);
    return fromat( exp.type().toString(exp.getContext()) );
}

function getExpFunString( body, pos ){
    let exp = getExpression(body,pos);
    let desc = exp.description();
    if( desc ){
        return fromat( desc.getFunType().toString( exp.getContext() ) )
    }else{
        return 'description is not exists';
    }
}

function getExpCallArgmentString(body, pos, index){
    let exp = getExpression(body,pos);
    let arg = exp.arguments[index];
    if( arg ){
        return fromat( arg.type().toString( exp.getContext() ) )
    }else{
        return 'Arguments is not exists';
    }
}

describe('infer type by test/V2.es -> ', function() {

    const creator = new compiler.Creator();
    let compilation = null;
    let errors = [];
    let module = null;
    beforeAll(async function() {
        compilation = await creator.startByFile('./test/V2.es');
        errors = compilation.compiler.errors;
        module = compilation.getModuleById("test.V2");
    });

    afterAll(()=>{
        errors.forEach( item=>{
            if( item.kind == 0 && compilation.errors.includes(item)){
                fail( item.toString() )
            }
        });
        compilation = null;
    })

    it('compiler success', function(){
        const start = module.getMember('start');
        let body = start.body.body;
        expect('string').toBe( getExpString(body,0) );
        expect('uint').toBe( getExpString(body,1) );
        expect('uint[]').toBe( getExpString(body,2) );
        expect('{key:string}').toBe( getExpString(body,3) );
        expect('{key:{name:{age:uint}}}').toBe( getExpString(body,4) );
        expect('{name:string,age:uint}').toBe( getExpString(body,5) );
        expect('uint').toBe( getExpString(body,6) );
        expect('string').toBe( getExpString(body,7) );
        expect('{name:string,age:uint}').toBe( getExpString(body,8) );
        expect('{name:uint,age:uint}').toBe( getExpString(body,9) );
        expect('string').toBe( getExpString(body,10) );
        expect('this["test"]').toBe( getExpString(body,11) );

        /**
         * var arr:number[] = [1];
         *  arr.unshift();
         */
        expect('number').toBe( getExpString(body,13) );

        //arr.push(1);
        expect('(...items:number[])=>number').toBe( getExpFunString(body,14) );

        //arr.forEach( item=>{});
        expect('(callbackfn:(value:number,index:number,array:number[])=>void,thisArg?:any)=>void').toBe( getExpFunString(body,15) );
        expect('(item:number)=>void').toBe( getExpCallArgmentString(body,15, 0) );

        // //arr.some( item=>!!item);
        expect('(item:number)=>boolean').toBe( getExpCallArgmentString(body,16, 0) );

        //new V2();
        //obj.type('sss');
        expect('string').toBe( getExpString(body,18) );

        //alias type
        expect('AddressReferenceType<string>').toBe( getDeclString(body,19) );
        expect('boolean').toBe( getExpString(body,20) );

    });

    it('should compiler error', function() {
        const result=(code,msg='',line=0,kind=0)=>{
            const error = errors.find( item=>{
                if( line && (item.range.start.line) !== line )return false;
                if( msg && item.message !== msg )return false;
                return item.code===code && item.kind === kind
            });
            const index = errors.indexOf(error);
            if( index >= 0 ){
                errors.splice(index,1);
                result(code, msg, line, kind)
            }
            return error ? error.message : 'Not match error';
        }
        expect(`Argument of type 'uint' is not assignable to parameter of type 'string'`)
        .toEqual( result(1002, `Argument of type 'uint' is not assignable to parameter of type 'string'`) );

        expect(`Type '"ages"' does not satisfy the constraint '"name" | "age"'`)
        .toEqual( result(1003, `Type '"ages"' does not satisfy the constraint '"name" | "age"'`) );

        expect(`Argument of type 'string' is not assignable to parameter of type 'number[]'`)
        .toEqual( result(1002, `Argument of type 'string' is not assignable to parameter of type 'number[]'`) );

        expect(`Argument of type 'boolean' is not assignable to parameter of type 'string'`)
        .toEqual( result(1002, `Argument of type 'boolean' is not assignable to parameter of type 'string'`) );

        expect(`Type 'uint' is not assignable to assignment of type 'string'`)
        .toEqual( result(1009, `Type 'uint' is not assignable to assignment of type 'string'`) );

        expect(`Type 'OType<string>' is not assignable to assignment of type 'OType<number>'`)
        .toEqual( result(1009, `Type 'OType<string>' is not assignable to assignment of type 'OType<number>'`) );
        
    });
    
});