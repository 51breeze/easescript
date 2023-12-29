const compiler = require("../compiler");
const TestUtils = require("../TestUtils");
describe('test GenericConstraint', function() {
    const creator = new compiler.Creator();
    let compilation = null;
    let errors = [];
    let module = null;
    let errorNum = 0;
    beforeAll(async function() {
        compilation = await creator.startByFile('./test/GenericConstraint.es');
        errors = compilation.errors;
        errorNum = errors.length;
        module = compilation.getModuleById("test.GenericConstraint");
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
        expect('Expected 2 errors').toContain( errorNum );

        let expression = body[4].expression
        expect('{}').toEqual(expression.type().toString())

    });

    it('should compiler error', function() {

        let [error, result] = TestUtils.createError(errors,`Type 'test.GenericConstraint' does not satisfy the constraint 'class<test.GenericConstraint>'`, 1003);
        expect(error).toEqual(result);

        [error, result] = TestUtils.createError(errors,`Type 'Array<any>' does not satisfy the constraint 'class<test.GenericConstraint>'`, 1003);
        expect(error).toEqual(result);
    });

});