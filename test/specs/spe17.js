const compiler = require("../compiler");
const TestUtils = require("../TestUtils");
describe('test components Child', function() {
    const creator = new compiler.Creator();
    let compilation = null;
    let errors = [];
    let module = null;
    let errorNum = 0;
    beforeAll(async function() {
        compilation = await creator.startByFile('./test/ComputeType.es');
        errors = compilation.errors;
        errorNum = errors.length;
        module = compilation.getModuleById("test.ComputeType");
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
        let expression = body[1].declarations[0];
        expect('string').toEqual(expression.type().toString())

        expression = body[5].declarations[0];
        expect('string | null').toEqual(expression.type().toString())

        expression = body[6].declarations[0];
        expect('uint').toEqual(expression.type().toString())

        expression = body[7].declarations[0];
        expect('null | string').toEqual(expression.type().toString())
    });


    it('getValue', function(){
        const start = module.getMember('getValue');
        let body = start.body.body;
        let expression = body[0].argument
        expect('string').toEqual(expression.type().toString())

    });

    it('compiler success', function(){
     
        let [error, result, matched] = TestUtils.createError(errors,`Type '{value: uint}' does not satisfy the constraint 'test.Ref<string>'`, 1003);
        expect(true).toBe(matched);

    });

});
