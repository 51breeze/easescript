const compiler = require("../compiler");
const TestUtils = require("../TestUtils");
describe('test Callable', function() {
    const creator = new compiler.Creator();
    let compilation = null;
    let errors = [];
    let module = null;
    let errorNum = 0;
    beforeAll(async function() {
        compilation = await creator.startByFile('./test/Callable.es');
        errors = compilation.errors;
        errorNum = errors.length;
        module = compilation.getModuleById("test.Callable");
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
        let expression = body[0].expression;
        expect('object').toEqual(expression.type().toString())
        expect('<uint>(name: uint)=>object').toEqual( expression.getDeclareFunctionType(expression.description()).type().toString(expression.getContext()))

        expression = body[1].expression;
        expect('object').toEqual(expression.type().toString())
        expect('<string>(name: string)=>object').toEqual( expression.getDeclareFunctionType(expression.description()).type().toString(expression.getContext()))

        expression = body[2].expression;
        expect('object').toEqual(expression.type().toString())
        let [,methodConstructor] = expression.getConstructMethod( expression.callee.type() );
        expect('(name: any)=>object').toEqual( methodConstructor.type().toString(expression.getContext()))


        expression = body[3].expression;
        expect('Object').toEqual(expression.type().toString())
        let [,methodConstructor2] = expression.getConstructMethod( expression.callee.type() );
        expect('<number>(name: number)=>Object').toEqual( methodConstructor2.type().toString(expression.getContext()))


        expression = body[4].expression;
        expect('object').toEqual(expression.type().toString())
        let [,methodConstructor3] = expression.getConstructMethod( expression.callee.type() );
        expect('(name: any)=>object').toEqual( methodConstructor3.type().toString(expression.getContext()))


        expression = body[5].expression;
        expect('Object').toEqual(expression.type().toString())
        let [,methodConstructor4] = expression.getConstructMethod( expression.callee.type() );
        expect('<string>(name: string)=>Object').toEqual( methodConstructor4.type().toString(expression.getContext()))

        expression = body[6].expression;
        expect('boolean').toEqual(expression.type().toString())
        let [,methodConstructor5] = expression.getConstructMethod( expression.callee.type() );
        expect('(name: string, arg: number)=>boolean').toEqual( methodConstructor5.type().toString(expression.getContext()))

        expression = body[8].expression;
        expect('boolean').toEqual(expression.type().toString())
        expect('(name: string, arg: number)=>boolean').toEqual( expression.getDeclareFunctionType(expression.description()).type().toString(expression.getContext()))

    });

    it('should compiler error', function() {
        let [error, result] = TestUtils.createError(errors,`Argument of type 'uint' is not assignable to parameter of type 'string'`, 1002);
        expect(error).toEqual(result);

        let [error2, result2] = TestUtils.createError(errors,`Argument of type 'uint[]' is not assignable to parameter of type 'string'`, 1002);
        expect(error2).toEqual(result2);

        let [error3, result3] = TestUtils.createError(errors,`Argument of type 'boolean' is not assignable to parameter of type 'string'`, 1002);
        expect(error3).toEqual(result3);
    });

});
