const compiler = require("../compiler");
const TestUtils = require("../TestUtils");
describe('test Callable', function() {
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

    it('should compiler error', function() {
        let [error, result] = TestUtils.createError(errors,`Argument of type 'string' is not assignable to parameter of type 'uint'`, 1002);
        expect(error).toEqual(result);

        [error, result] = TestUtils.createError(errors,`Argument of type 'boolean' is not assignable to parameter of type 'string'`, 1002);
        expect(error).toEqual(result);

        // let [error2, result2] = TestUtils.createError(errors,`Argument of type 'uint[]' is not assignable to parameter of type 'string'`, 1002);
        // expect(error2).toEqual(result2);

        // let [error3, result3] = TestUtils.createError(errors,`Argument of type 'boolean' is not assignable to parameter of type 'string'`, 1002);
        // expect(error3).toEqual(result3);
    });

});
