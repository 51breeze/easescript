const compiler = require("../compiler");
const TestUtils = require("../TestUtils");
describe('test InferParamType', function() {
    const creator = new compiler.Creator();
    let compilation = null;
    let errors = [];
    let module = null;
    beforeAll(async function() {
        compilation = await creator.startByFile('./test/InferParamType.es');
        errors = compilation.compiler.errors;
        module = compilation.getModuleById("test.InferParamType");
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
        let argument = body[0].expression.arguments[0];
        let success = argument.attribute('success');
        expect('(res: ChooseImageSuccessCallbackResult)=>void').toBe( success.type().toString() );

        let fail = argument.attribute('fail');
        expect('(err: Error)=>void').toBe( fail.type().toString() );

        let contentType = argument.attribute('header').init.attribute('contentType')
        expect('(res: string)=>void').toBe( contentType.type().toString() ); 

    });

});