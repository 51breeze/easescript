const compiler = require("../compiler");
describe('test', function() {
    const creator = new compiler.Creator();

    creator.startByFile('./test/InferReturn.es').then( compilation=>{
        const errors = compilation.compiler.errors;
        const module = compilation.getModuleById("test.InferReturn");
        it('compiler success', function(){
            const start = module.getMember('start');
            let body = start.body.body;
            expression = body[0].expression;
            var type = expression.type();
            var ctx =expression.getContext();
            expect(
                `{
                    name: string,
                    count: uint
                }[]`.replace(/[\s\r\n]/g,'')
            ).toBe( ctx.apply(type).toString().replace(/[\s\r\n]/g,'') );

            expression = body[1].expression;
            type = expression.type();

            expect(`
            {
                name: string,
                age: uint,
                address?: string,
                nickname?: string,
                flag?: boolean
            }[]
            `.replace(/[\s\r\n]/g,'')).toBe( type.toString().replace(/[\s\r\n]/g,'')  )


            expression = body[2].expression;
            type = expression.type();

            expect(`
            {
                name: string,
                age?: uint
            } | null
            `.replace(/[\s\r\n]/g,'')).toBe( type.toString().replace(/[\s\r\n]/g,'')  )
            
        });

        it('should compiler error', function() {
            

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