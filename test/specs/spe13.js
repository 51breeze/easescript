const compiler = require("../compiler");
const TestUtils = require("../TestUtils");
describe('test GenericConstraint', function() {
    const creator = new compiler.Creator();
    let compilation = null;
    let errors = [];
    let module = null;
    let errorNum = 0;
    beforeAll(async function() {
        compilation = await creator.startByFile('./test/Param.es');
        errors = compilation.errors;
        errorNum = errors.length;
        module = compilation.getModuleById("test.Param");
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
        expect('string').toEqual(expression.type().toString())

        let arrayProperty = body[1].declarations[0].init.elements[0].attribute('items')
        expression = arrayProperty.init.elements[0];
        expect('(target: string)=>void').toEqual(expression.type().toString())
        expression = arrayProperty.init.elements[1].attribute('get').init;
        expect('(target: string)=>number').toEqual(expression.type().toString())

    });

    it('should compiler error', function() {

        let [error, result] = TestUtils.createError(errors,`Variable 'T' cannot redeclare`, 1007);
        expect(error).toEqual(result);

        [error, result] = TestUtils.createError(errors,`'name1000' is not defined`, 1013);
        expect(error).toEqual(result);

        [error, result] = TestUtils.createError(errors,`'age' is not defined`, 1013);
        expect(error).toEqual(result);

        [error, result] = TestUtils.createError(errors,`Property 'age' is not exists`, 1080);
        expect(error).toEqual(result);

        [error, result] = TestUtils.createError(errors,`Argument of type 'string' is not assignable to parameter of type '{name: unknown,type: number}'`, 1002);
        expect(result).not.toContain('(Not found error)');

        [error, result] = TestUtils.createError(errors,`Missing object property the 'type'`, 1152);
        expect(result).not.toContain('(Not found error)');

        
    });

});