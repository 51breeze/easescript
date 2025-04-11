const compiler = require("../compiler");
describe('test For by test/ForOf.es > ', function() {
    const creator = new compiler.Creator();
    let compilation = null;
    let errors = [];
    let module = null;
    beforeAll(async function() {
        compilation = await creator.startByFile('./test/ForOf.es');
        errors = compilation.compiler.errors;
        module = compilation.getModuleById("test.ForOf");
    });

    afterAll(()=>{
        errors.forEach( item=>{
            if( item.kind == 0 && compilation.errors.includes(item)){
                fail( item.toString() )
            }
        });
        compilation = null;
    })
   
    it('compiler success', function(){
        const start = module.getMember('start');
        const body = start.body.body;
        let expression = body[0];

        expect('T').toBe( expression.left.declarations[0].type().toString() );

        expression = body[2];
        ctx = expression.left.declarations[0].id.getContext();

        expect('string | uint').toBe( ctx.apply( expression.left.declarations[0].type() ).toString() );

        expression = body[4];
        ctx = expression.left.declarations[0].id.getContext();
        expect('string | uint').toBe( ctx.apply( expression.left.declarations[0].type() ).toString() );

        expression = body[5];
        ctx = expression.left.declarations[0].id.getContext();
        expect('string').toBe( ctx.apply( expression.left.declarations[0].type() ).toString() );

        expression = body[7];
        ctx = expression.right.description().init.getContext();
        expect('string').toBe( ctx.apply( expression.left.declarations[0].type() ).toString() );

        expression = body[8].expression;
        expect('IteratorReturnResult<string>').toBe( expression.type().toString() );

        expression = body[12];
        ctx = expression.right.description().getContext();
        expect('[string,test.ForOf<string>]').toBe( ctx.apply( expression.left.declarations[0].type() ).toString() );

        expression = body[13];
        ctx = expression.right.description().getContext();
        expect('test.ForOf<string>').toBe( ctx.apply( expression.left.declarations[0].type() ).toString() );

        expression = body[14];
        ctx = expression.right.getContext();
        expect('test.ForOf<string>').toBe( ctx.apply( expression.left.declarations[0].type() ).toString() );

        expression = body[15].expression;
        expect('IteratorReturnResult<test.ForOf<string>>').toBe( expression.type().toString() );
        expect('Iterator<test.ForOf<string>>').toBe( expression.callee.object.type().toString() );

        expression = body[16];
        expect('test.ForOf<array> | string').toBe( expression.left.declarations[0].type().toString() );

        expression = body[17];
        expect('array').toBe( expression.left.declarations[0].type().toString() );

    });

    
});