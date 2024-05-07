const compiler = require("../compiler");
const TestUtils = require("../TestUtils");
describe('test keyof type by test/Index.es > ', function() {
    
    const creator = new compiler.Creator();
    let compilation = null;
    let errors = [];
    let module = null;
    beforeAll(async function() {
        compilation = await creator.startByFile('./test/Index.es');
        errors = compilation.compiler.errors;
        module = compilation.getModuleById("test.Index");
    });

    afterAll(()=>{
        errors.forEach( item=>{
            if( (item.kind == 0 || item.kind == 1) && compilation.errors.includes(item)){
                fail( item.toString() )
            }
        });
        compilation = null;
    })
        
    it('compiler success', function(){
        expect('test.Index').toBe( module.toString() )
        const start = module.getMember('start');
        const body = start.body.body;
        let expression = body[0].expression;


        expect('this["start" | "getListItems"][]').toBe( expression.type().toString() );
        expression = body[2].expression;
        expect('((()=>void) | (<T5, K6 extends keyof T5>(obj: T5, name: K6)=>T5[K6]) | (<T500, K600 extends keyof T500>(obj: T500, items: K600[])=>T500[K600][]))[]')
            .toBe( expression.type().toString() );
        expect('<T500, K600 extends keyof T500>(obj: T500, items: K600[])=>T500[K600][]').toBe( body[3].init.type().toString() );
        expression = body[4].declarations[0];
        expect( expression.type() === body[3].type() ).toBeTrue();

        expression = module.getMember('predicateType');
        expect(`string | null`).toBe( expression.getReturnedType().toString() );

        let returnArg = expression.body.body[1].consequent.body[0].argument;
        expect('string').toBe( returnArg.type().toString() )
        expect('Number').toBe( returnArg.callee.object.type().toString() );

        returnArg = expression.body.body[2].argument;
        expect('string').toBe(returnArg.consequent.type().toString());

    });

    it('compiler error', function() {
        let error = creator.removeError( errors, 1003, 25 );
        expect(`Type '"getListItems222"' does not satisfy the constraint '"start" | "getList" | "getListItems"'`).toBe( error ? error.message : 'empty' )

        let [error2, result] = TestUtils.createError(errors,`The 'logical and' type assertions refers to the same expressions and may not satisfy conditions. are you to fix it?`, 1187, 1);
        expect(error2).toEqual(result);

        [error2, result] = TestUtils.createError(errors,`Refers object the 'toFixed' property is ambiguous. should using type assertions to constraint`, 1188, 1);
        expect(error2).toEqual(result);

        [error2, result] = TestUtils.createError(errors,`Refers object contains null type should using optional chain operator the '?.'`, 1190, 1);
        expect(error2).toEqual(result);


    });

});