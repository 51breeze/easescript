const compiler = require("../compiler");
const TestUtils = require("../TestUtils");
describe('test', function() {
    const creator = new compiler.Creator();
    let compilation = null;
    let errors = [];
    let module = null;
    beforeAll(async function() {
        compilation = await creator.startByFile('./test/NewInstance.es');
        errors = compilation.compiler.errors;
        module = compilation.getModuleById("test.NewInstance");
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
        let body = start.body.body;
        let expression = body[0].expression;
        expect('test.NewInstance<string>').toBe( expression.type().toString() );

        expression = body[1].expression;
        var type = expression.type();
        var ctx =expression.getContext();
        expect('class<test.NewInstance<string>>').toBe( ctx.apply(type).toString() );

        expression = body[2].expression;
        ctx =expression.getContext();
        type = expression.type();
        expect('test.NewInstance<string>').toBe( ctx.apply(type).toString() );

        expression = body[3].expression;
        ctx =expression.getContext();
        type = expression.type();
        expect('class<Array<test.NewInstance<number>>>').toBe( ctx.apply(type).toString() );

        expression = body[4].declarations[0];
        ctx =expression.getContext();
        type = expression.type();
        expect('class<test.NewInstance<array>>').toBe( ctx.apply(type).toString() );

        expression = body[5].expression;
        ctx =expression.getContext();
        type = expression.type();
        expect('test.NewInstance<array>').toBe( ctx.apply(type).toString() );

        expression = body[8].expression;
        ctx =expression.getContext();
        type = expression.type();
        expect('array').toBe( ctx.apply(type).toString() );

        expression = body[10].expression;
        ctx =expression.getContext();
        type = expression.type();
        expect('boolean').toBe( ctx.apply(type).toString() );

        expression = body[12].expression;
        ctx =expression.getContext();
        type = expression.type();
        expect('AddressReferenceType<string>').toBe( ctx.apply(type).toString() );

        expression = body[13].expression;
        ctx =expression.getContext();
        type = expression.type();
        expect(`OType<string>`).toBe( ctx.apply(type).toString() );

        expression = body[14].expression;
        ctx =expression.getContext();
        type = expression.type();
        expect(`OType<boolean>`).toBe( ctx.apply(type).toString().replace(/[\s\r\n]/g,'') );

        expression = body[21].expression.callee.object;
        ctx =expression.getContext();
        type = expression.type();
        expect(`number[]`).toBe( ctx.apply(type).toString().replace(/[\s\r\n]/g,'') );
        
    });


    it('check newProxy', function(){
        const start = module.getMember('newProxy');
        let body = start.body.body;
        let expression = body[1].declarations[0].init;
        expect('()=>{}').toBe( start.type().toString() );
        let defs = expression.definition();
        let def = Array.isArray(defs) ? defs[0] : defs;
        expect(def.expre).toContain( '(constructor) public Proxy<{}>(target: {}, handler: ProxyHandler<{}>): {}'  );
        const config = expression.arguments[1];
        expect('(target: {}, key: string, value: any)=>boolean').toBe(config.attribute('set').type().toString(expression.getContext(), {inferTypeValueFlag:true}));
        expect('{}').toBe(config.attribute('set').init.params[0].type().toString(expression.getContext()));
    });

    it('check assignment', function(){
        const start = module.getMember('assignment');
        let body = start.body.body;
        let expression = body[0].declarations[0].init;
        expect('()=>ProxyHandler<{}>').toBe( start.type().toString() );
        expression = body[1].expression.right;
        expect('(target: {}, key: string, value: any)=>any').toBe(expression.attribute('get').type().toString(expression.getContext(), {inferTypeValueFlag:true}));
    });

    it('check arrayType', function(){
        const start = module.getMember('arrayType');
        let body = start.body.body;
        let expression = body[0].declarations[0].init;
        expect('()=>ProxyHandler<{}>[]').toBe( start.type().toString() );

        expression = expression.elements[0];
        expect('(target: {}, key: string, value: any)=>boolean').toBe(expression.attribute('set').type().toString( expression.getContext(), {inferTypeValueFlag:true} ));
        expression = body[1].expression.arguments[0];
        expect('(target: {}, key: string, value: any)=>any').toBe(expression.attribute('get').type().toString(expression.getContext(), {inferTypeValueFlag:true}));
        
    });

    it('should compiler error', function() {

        let [error, result] = TestUtils.createError(errors,`Argument of type 'string' is not assignable to parameter of type 'AddressReferenceType<number>'`, 1002);
        expect(error).toEqual(result);

        [error, result] = TestUtils.createError(errors,`Argument of type 'string' is not assignable to parameter of type 'number[]'`, 1002);
        expect(error).toEqual(result);
    });

    it('test testDeclareVarCall', function() {

        const start = module.getMember('testDeclareVarCall');
        let body = start.body.body;
        let expression = body[0].declarations[0].init;
        expect('CustomEvent<{mainApp:this}>').toBe( expression.type().toString().replace(/[\s\r\n]/g,'') );
    });
       
});