const compiler = require("../compiler");
describe('test', function() {
    const creator = new compiler.Creator();
    it('bug.HttpRequest.Promise', async function() {
        const compilation = await creator.startByFile('./bug/HttpRequest.es')
        const errors = compilation.compiler.errors;
        if( errors.length===0 ){
            const module = compilation.getModuleById("bug.HttpRequest");
            const start = module.getMethod('start');
            let body = start.body.body;
            let expression = body[0].expression
            var type = expression.type();
            var ctx =expression.getContext();
            expect(`Promise<any>`).toBe( ctx.apply(type).toString().replace(/[\s\r\n]/g,'') );
        }else{
            errors.forEach( item=>{
                if( item.kind == 0 && compilation.errors.includes(item)){
                    fail( item.toString() )
                }
            });
        }
    })
});