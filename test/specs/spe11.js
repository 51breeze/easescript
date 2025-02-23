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
            if( item.kind == 0 && compilation.errors.includes(item)){
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

        argument = body[3].expression.arguments[0];
        let image = argument.attribute('image');

        let param = image.type().params[0]
        expect('this').toBe( param.type().toString() );
        
        expect('{}').toBe(  body[4].expression.type().toString() );

    });

    it('testArr', function(){
        const start = module.getMember('arr');
        let body = start.body.body[0].argument
        let expression =  body.arguments[0];
        expect('(computedGetters: {}, name: string)=>{}').toBe( expression.type().toString(body.getContext()) );
    });

});