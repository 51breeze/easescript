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
        expect('(key: uint, value: uint)=>this').toEqual( expression.getDeclareFunctionType(expression.description()).type().toString(expression.getContext()))

        expression = body[5].declarations[0].init;
        expect('Map<number, string>').toEqual(expression.type().toString())

        method = expression.getConstructMethod( expression.callee.type() )[1]
        expect('(entries?: [number,string][] | null)=>Map<number, string>').toEqual( method.type().toString(expression.getContext()))

        expression = body[6].expression;
        expect('(key: number, value: string)=>this').toEqual( expression.getDeclareFunctionType(expression.description()).type().toString(expression.getContext()))

    });

    it('testCallArray', function(){
        const start = module.getMember('testCallArray');
        let body = start.body.body;
        let expression = body[0].declarations[0].init;
        expect('any[]').toEqual(expression.type().toString(expression.getContext()))

        expression = body[1].expression;
        expect('(...items: any[])=>number').toEqual( expression.getDeclareFunctionType(expression.description()).type().toString(expression.getContext()))

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
        expect('(...items: any[])=>number').toEqual(expression.getDeclareFunctionType(expression.description()).type().toString(expression.getContext()) )

        expression = body[2].declarations[0].init;
        expect('uint[]').toEqual(expression.type().toString(expression.getContext()))

        expression = body[5].declarations[0].init;
        expect('(uint | string | boolean)[]').toEqual(expression.type().toString(expression.getContext()))
        
        expression = body[6].expression;
        expect('(...items: (uint | string | boolean)[])=>number').toEqual(expression.getDeclareFunctionType(expression.description()).type().toString(expression.getContext()) )

        expression = body[8].declarations[0].init;
        expect('string[]').toEqual(expression.type().toString(expression.getContext()))
    });

    it('testStaticArray', function(){
        const start = module.getMember('testStaticArray');
        let body = start.body.body;
        let expression = body[0].declarations[0].init;

        expression = body[1].expression;
        expect('(...items: uint[])=>number').toEqual(expression.getDeclareFunctionType(expression.description()).type().toString(expression.getContext()))

        expression = body[2].expression;
        let fun = expression.getDeclareFunctionType(expression.description());
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

    });

});