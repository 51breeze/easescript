const compiler = require("../compiler");
describe('test', function() {
    const creator = new compiler.Creator();

    creator.startByFile('./test/MergeTypes.es').then( compilation=>{
        const errors = compilation.compiler.errors;
        const module = compilation.getModuleById("test.MergeTypes");
        it('compiler success', function(){
            const start = module.getMember('start');
            let body = start.body.body;

            let expression = body[0].expression;
            expect(`{
                a: ({
                        s: (string | (uint | string[])[] | uint)[],
                        d: {
                                a: string,
                                b: string,
                                d: string,
                                e: (string | (uint | string[])[] | uint)[],
                                f: {
                                        a: string,
                                        b: string,
                                        c: {
                                                a: string
                                        }
                                }
                        }
                } | (string | (uint | string[])[] | uint)[])[],
                c: string,
                d: string,
                e: uint
            }`.replace(/(\r\n|\s)+/g,'') ).toBe( expression.getTypeDisplayName( expression.type() ).replace(/(\r\n|\s)+/g,'') );
            
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