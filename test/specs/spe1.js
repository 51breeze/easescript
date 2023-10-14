const compiler = require("../compiler");
describe('test', function() {
    const creator = new compiler.Creator();

    creator.startByFile('./test/Index.es').then( compilation=>{
        const errors = compilation.compiler.errors;
        const module = compilation.getModuleById("test.Index");
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
        });

        it('compiler error', function() {
            let error = creator.removeError( errors, 1003, 25 );
            expect(`Type '"getListItems222"' does not satisfy the constraint '"start" | "getList" | "getListItems"'`).toBe( error ? error.message : 'empty' )
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
                fail( error.message );
            });
        });
    });
});