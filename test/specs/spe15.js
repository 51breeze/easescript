const compiler = require("../compiler");
const TestUtils = require("../TestUtils");
describe('test Generics', function() {
    const creator = new compiler.Creator();
    let compilation = null;
    let errors = [];
    let module = null;
    let errorNum = 0;
    beforeAll(async function() {
        compilation = await creator.startByFile('./test/Generics.es');
        errors = compilation.errors;
        errorNum = errors.length;
        module = compilation.getModuleById("test.Generics");
    });

    afterAll(()=>{
        errors.forEach( item=>{
            if( item.kind == 0 ){
                fail( item.toString() )
            }
        });
        compilation = null;
    })

    
    it('compiler success', function(){
        const start = module.getMember('start');
        let body = start.body.body;
        let expression = body[0].declarations[0].init;
        expect('Map<any, any>').toEqual(expression.type().toString())

        let [,method] = expression.getConstructMethod( expression.callee.type() );
        expect('(entries?: [any,any][] | null)=>Map<any, any>').toEqual( method.type().toString(expression.getContext()))

        expression = body[2].declarations[0].init;
        expect('Map<uint, uint>').toEqual(expression.type().toString())

        method = expression.getConstructMethod( expression.callee.type() )[1]
        expect('(entries?: [uint,uint][] | null)=>Map<uint, uint>').toEqual( method.type().toString(expression.getContext()))

        expression = body[3].expression;
        expect('(key: uint, value: uint)=>this').toEqual( expression.descriptor().type().toString(expression.getContext()))

        expression = body[5].declarations[0].init;
        expect('Map<number, string>').toEqual(expression.type().toString())

        method = expression.getConstructMethod( expression.callee.type() )[1]
        expect('(entries?: [number,string][] | null)=>Map<number, string>').toEqual( method.type().toString(expression.getContext()))

        expression = body[6].expression;
        expect('(key: number, value: string)=>this').toEqual( expression.descriptor().type().toString(expression.getContext()))

    });

    it('testCallArray', function(){
        const start = module.getMember('testCallArray');
        let body = start.body.body;
        let expression = body[0].declarations[0].init;
        expect('any[]').toEqual(expression.type().toString(expression.getContext()))

        expression = body[1].expression;
        expect('(...items: any[])=>number').toEqual( expression.descriptor().type().toString(expression.getContext()))

        expression = body[2].declarations[0].init;
        expect('uint[]').toEqual(expression.type().toString(expression.getContext()))

        expression = body[5].declarations[0].init;
        expect('(uint | string | boolean)[]').toEqual(expression.type().toString(expression.getContext()))

        expression = body[8].declarations[0].init;
        expect('string[]').toEqual(expression.type().toString(expression.getContext()))

    });

    it('testNewArray', function(){
        const start = module.getMember('testNewArray');
        let body = start.body.body;
        let expression = body[0].declarations[0].init;
        expect('any[]').toEqual(expression.type().toString(expression.getContext()))

        expression = body[1].expression;
        expect('(...items: any[])=>number').toEqual(expression.descriptor().type().toString(expression.getContext()) )

        expression = body[2].declarations[0].init;
        expect('uint[]').toEqual(expression.type().toString(expression.getContext()))

        expression = body[5].declarations[0].init;
        expect('(uint | string | boolean)[]').toEqual(expression.type().toString(expression.getContext()))
        
        expression = body[6].expression;
        expect('(...items: (uint | string | boolean)[])=>number').toEqual(expression.descriptor().type().toString(expression.getContext()) )

        expression = body[8].declarations[0].init;
        expect('string[]').toEqual(expression.type().toString(expression.getContext()))
    });

    it('testStaticArray', function(){
        const start = module.getMember('testStaticArray');
        let body = start.body.body;
        let expression = body[0].declarations[0].init;

        expression = body[1].expression;
        expect('(...items: uint[])=>number').toEqual(expression.descriptor().type().toString(expression.getContext()))

        expression = body[2].expression;
        let fun = expression.descriptor();
        expect('<uint[], string>(target: Iterator<uint[]> | ArrayLike<uint[]>, callback?: (value: uint[], key: number)=>string)=>string[]').toEqual(
            fun.type().toString(expression.getContext())
        );
        expect('(v: uint[], k: number)=>string').toEqual(
            expression.arguments[1].type().toString(expression.arguments[1].getContext(), {inferTypeValueFlag:true})
        );

        expression = expression.arguments[1].body.body[0].declarations[0];
        expect('uint').toEqual(expression.init.type().toString())

        // let ctx = expression.init.object.getContext();
        // while(ctx){
        //     ctx.dataset.forEach((v,k)=>{
        //         console.log( k,  v.type().toString() )
        //     });
        //     ctx = ctx.parent;
        //     if(ctx && ctx.stack){
        //         console.log( ctx.stack.toString() )
        //     }
        // }

        expression = body[3].expression;
        expect('uint[][]').toEqual(expression.type().toString())
    });

    it('testRecord', function(){
        const start = module.getMember('testRecord');
        let body = start.body.body;
        let expression = body[1].expression.left
        expect('TypeObjectPropertyDefinition').toEqual(expression.description().toString())
        expect('any').toEqual(expression.description().type().toString(expression.getContext()))

        expression = body[3].expression.left
        expect('TypeObjectPropertyDefinition').toEqual(expression.description().toString())
        expect('number').toEqual(expression.description().type().toString(expression.getContext()))

        expression = body[4].expression.left
        expect('TypeObjectPropertyDefinition').toEqual(expression.description().toString())
        expect('number').toEqual(expression.description().type().toString(expression.getContext()))

        expression = body[5].declarations[0];
        expect('number').toEqual(expression.type().toString())

        expression = body[7].expression.left
        expect(null).toBe(expression.description() ? true : null)

        expression = body[8].expression.left
        expect('TypeObjectPropertyDefinition').toBe(expression.description().toString())
        expect('string').toEqual(expression.description().type().toString(expression.getContext()))

        expression = body[9].declarations[0];
        expect('string').toEqual(expression.type().toString())


    });

    it('testArrayMap', function(){
        const start = module.getMember('testArrayMap');
        let body = start.body.body;
        let expression = body[0].argument;
        expect('string[]').toEqual(expression.type().toString())
        expression = expression.arguments[0].params[0];
        expect('{key:string,children:any[]}').toEqual(expression.type().toString(expression.getContext()).replace(/[\r\n\s]+/g,''))
    });

    it('testPredicate', function(){
        const start = module.getMember('testPredicate');
        let body = start.body.body;
        let expression = body[0].declarations[0]
        expect('boolean').toEqual(expression.type().toString())

        expression = body[1].consequent.body[0].declarations[0];
        expect('string').toEqual(expression.type().toString())

        expression =  body[4].consequent.body[0].declarations[0];
        expect('uint').toEqual(expression.type().toString())

        console.log( expression.init.raw()  )

        expect('(local const) age:uint').toEqual(expression.init.definition().expre)

        expression = body[6].consequent.body[0].declarations[0];
        expect('uint').toEqual(expression.type().toString())
        expect('(local const) age:uint').toEqual(expression.init.definition().expre)
    });

    it('should compiler error', function() {
        let [error, result] = TestUtils.createError(errors,`Argument of type 'string' is not assignable to parameter of type 'uint'`, 1002);
        expect(error).toEqual(result);

        [error, result] = TestUtils.createError(errors,`Argument of type 'boolean' is not assignable to parameter of type 'string'`, 1002);
        expect(error).toEqual(result);


        //testCallArray
        [error, result] = TestUtils.createError(errors,`Argument of type '{}' is not assignable to parameter of type 'string'`, 1002);
        expect(error).toEqual(result);

        [error, result] = TestUtils.createError(errors,`Argument of type '[]' is not assignable to parameter of type '(uint | string | boolean)[]'`, 1002);
        expect(error).toEqual(result);

        [error, result] = TestUtils.createError(errors,`Argument of type 'string' is not assignable to parameter of type 'uint[]'`, 1002);
        expect(error).toEqual(result);

        //testNewArray
        [error, result] = TestUtils.createError(errors,`Argument of type 'boolean' is not assignable to parameter of type 'string[]'`, 1002);
        expect(error).toEqual(result);

        [error, result] = TestUtils.createError(errors,`Argument of type '{}' is not assignable to parameter of type 'uint | string | boolean'`, 1002);
        expect(error).toEqual(result);

        //testRecord
        [error, result] = TestUtils.createError(errors,`'b2.phone' does not exist.`, 1060);
        expect(error).toEqual(result);

        [error, result] = TestUtils.createError(errors,`Type 'string' is not assignable to assignment of type 'number'`, 1009);
        expect(error).toEqual(result);

        //testNewArray  a2.push('error') //error
        [error, result] = TestUtils.createError(errors,`Argument of type 'string' is not assignable to parameter of type 'uint[]'`, 1002);
        expect(error).toEqual(result);

    });

});
