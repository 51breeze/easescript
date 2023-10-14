const compiler = require("../compiler");
describe('test', function() {
    const creator = new compiler.Creator();

    creator.startByFile('./test/PromiseTest.es').then( compilation=>{
        const errors = compilation.compiler.errors;
        const module = compilation.getModuleById("test.PromiseTest");
        it('compiler success', function(){
            const start = module.getMember('start');
            let body = start.body.body;

            let expression = body[0].expression;
            expect('Promise<[string,number]>').toBe( expression.type().toString() );

            expression = body[1].declarations[0];
            expect('Promise<[string,number][]>').toBe( expression.type().toString() );

            expression = body[2].expression.arguments[0]
            expect('(data: [string,number][])=>void').toBe( expression.type().toString( body[2].expression.getContext() ) );

            expression = body[3].expression
            expect('Promise<[string,number][]>').toBe( expression.type().toString() );

            expression = body[4].expression
            expect('Promise<([string,number,array]|{bs:[string,number]})[]>').toBe( expression.type().toString().replace(/\s/g,'') );

            expression = body[5].expression
            expect('(uint | string)[]').toBe( expression.type().toString() );


            let method = module.getMember('loadRemoteData');
            body = method.body.body;
            expression = body[0].declarations[0]
            expect('[string,number]').toBe( expression.type().toString() );

            method = module.getMember('loadRemoteData4');
            body = method.body.body;
            expression = body[3].declarations[0]
            expect('[string,array]').toBe( expression.type().toString() );
            
        });

        it('compiler error', function() {
            let error = creator.removeError( errors, 1009, 66 );
            expect(`Type '{bss:[string,number]}' is not assignable to assignment of type '[string,number]'`.replace(/(\r\n|\s)+/g,''))
            .toBe( error.message.replace(/(\r\n|\s)+/g,'') )

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