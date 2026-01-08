const compiler = require("../compiler");
describe('test InferReturn', function() {
    const creator = new compiler.Creator();
    let compilation = null;
    let errors = [];
    let module = null;
    beforeAll(async function() {
        compilation = await creator.startByFile('./test/InferReturn.es');
        errors = compilation.compiler.errors;
        module = compilation.getModuleById("test.InferReturn");
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

        expect(`[{
            name: string,
            age: uint,
            address?: string,
            nickname?: string,
            flag?: boolean
        }]`.replace(/[\s\r\n]/g,'')).toBe( type.toString().replace(/[\s\r\n]/g,'')  )


        expression = body[2].expression;
        type = expression.type();

        expect(`
        {
            name: string,
            age?: uint
        } | null
        `.replace(/[\s\r\n]/g,'')).toBe( type.toString().replace(/[\s\r\n]/g,'')  )


        expression = body[3].expression;
        type = expression.type();

        expect(`string|uint|boolean`.replace(/[\s\r\n]/g,'')).toBe( type.toString().replace(/[\s\r\n]/g,'')  )

        expression = body[5].expression;

        expect(`[Record<T, K>,string,DOMRect] | null`).toBe( expression.type().toString() )
        
    });


    it('testReturnClassGenericType', function(){
        const start = module.getMember('testReturnClassGenericType');
        let body = start.body.body;
        let expression = body[1].expression;
        let call = expression.arguments[0]
        
    });
       
});