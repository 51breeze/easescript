const compiler = require("../compiler");
describe('test', function() {
    const creator = new compiler.Creator();

    creator.startByFile('./test/Http.es').then( compilation=>{
        const errors = compilation.compiler.errors;
        const module = compilation.getModuleById("test.Http");
        it('compiler success', function(){
            const start = module.getMember('start');
            let body = start.body.body;
            let expression = body[0].expression;
            //expect('test.NewInstance<string>').toBe( expression.type().toString() ); 
            
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