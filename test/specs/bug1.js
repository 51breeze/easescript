const compiler = require("../compiler");
const TestUtils = require('../TestUtils');
describe('test', function() {
    const creator = new compiler.Creator();

    creator.startByFile('./bug/Spec1.es').then( compilation=>{
        const errors = compilation.compiler.errors;
        const module = compilation.getModuleById("bug.Spec1");
        it('compiler success', function(){
             const start = module.getMember('start');
             let body = start.body.body;
             let expression = body[0].expression
             var type = expression.type();
             var ctx =expression.getContext();
             expect(`{content:string}[]`).toBe( type.toString(ctx).replace(/[\s\r\n]/g,'') );

             const shortcutTelmplates = module.getMember('shortcutTelmplates', 'get');
             body = shortcutTelmplates.body.body;
             body = body[1].consequent.body
             body = body[1].consequent.body
             expression = body[0].argument;
             expect(`(property)shortcutTelmplates:{content:string}[]`).toBe( TestUtils.fromat(expression.definition().expre) );

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