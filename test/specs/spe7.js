const compiler = require("../compiler");
describe('test Http', function() {
    const creator = new compiler.Creator();
    let compilation = null;
    let errors = [];
    let module = null;
    beforeAll(async function() {
        compilation = await creator.startByFile('./test/Http.es');
        errors = compilation.compiler.errors;
        module = compilation.getModuleById("test.Http");
    });

    afterAll(()=>{
        errors.forEach( item=>{
            if( item.kind == 0 && compilation.errors.includes(item) ){
                fail( item.toString() )
            }
        });
        compilation = null;
    })

   
    it('compiler success', function(){
        const start = module.getMember('start');
        let body = start.body.body;
        let expression = body[0].expression;
        //expect('test.NewInstance<string>').toBe( expression.type().toString() ); 
        
    });

       
});