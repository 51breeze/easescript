const compiler = require("../compiler");
describe('test TypeCheck', function() {
    const creator = new compiler.Creator();
    let compilation = null;
    let errors = [];
    let module = null;
    beforeAll(async function() {
        compilation = await creator.startByFile('./test/TypeCheck.es');
        errors = compilation.compiler.errors;
        module = compilation.getModuleById("test.TypeCheck");
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
        expression = body[1].expression;
        var type = expression.type();
        var ctx =expression.getContext();
        
        expect('string').toBe( ctx.apply(type).toString() );

        const fetchApi = module.getMember('fetchApi');
        let fetchApiBody = fetchApi.body.body;

        expression = fetchApiBody[0].argument;
        type = expression.arguments[0].type();
        ctx =expression.getContext();
        expect('(resolve: (value: [string,int])=>void, reject: (reason?: any)=>void)=>void').toBe( type.toString(ctx) );

        expression = expression.arguments[0].body.body[0].expression.arguments[0].body.body[0].expression
        expect('type (value: [string,int])=>void').toBe( expression.definition().expre );
        
    });

    it('should compiler error', function() {
        const result=(code,line,kind=0)=>{
            const error = errors.find( item=>{
                return item.code===code && item.kind === kind && (item.range.start.line) === line
            });
            const index = errors.indexOf(error);
            if( index >= 0 ){
                errors.splice(index,1);
            }
            return error ? error.message : 'Not found error';
        }
        expect(`Type 'boolean' is not assignable to assignment of type 'string[]'`).toEqual( result(1009,8) );
        expect(`Type 'uint' is not assignable to assignment of type 'unknown'`).toEqual( result(1009,15) );

    });
      
});