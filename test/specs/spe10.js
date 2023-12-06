const compiler = require("../compiler");
describe('test', function() {
    const creator = new compiler.Creator();
    let compilation = null;
    let errors = [];
    let module = null;
    beforeAll(async function() {
        compilation = await creator.startByFile('./test/TestOverride.es');
        errors = compilation.compiler.errors;
        module = compilation.getModuleById("test.TestOverride");
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
        let expression = body[1].declarations[0];
        var type = expression.type();
        var ctx =expression.getContext();
        expect(`string[]`).toBe( ctx.apply(type).toString().replace(/[\s\r\n]/g,'') );

        expression = body[2].declarations[0];
        type = expression.type();
        ctx =expression.getContext();
        expect(`{name:string,age:int}[]`).toBe( ctx.apply(type).toString().replace(/[\s\r\n]/g,'') );
        
    });
       
});