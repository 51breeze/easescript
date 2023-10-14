const compiler = require("../compiler");
const TestUtils = require("../TestUtils");
describe('test', function() {
    const creator = new compiler.Creator();

    creator.startByFile('./test/InferParamType.es').then( compilation=>{
        const errors = compilation.compiler.errors;
        const module = compilation.getModuleById("test.InferParamType");
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

        afterAll(()=>{ 
            errors.forEach( item=>{
                if( item.kind == 0 ){
                    fail( item.toString() )
                }
            });
        });

    }).catch( error=>{
        const errors=error.errors || [error];
        it('compiler failed', function() {
            errors.forEach((error)=>{
                console.log(error)
                fail( error.message );
            });
        });
    });
});