const compiler = require("../compiler");
describe('test', function() {
    const creator = new compiler.Creator();

    creator.startByFile('./bug/HttpRequest.es').then( compilation=>{
        const errors = compilation.compiler.errors;
        const module = compilation.getModuleById("bug.HttpRequest");
        it('compiler success', function(){
             const start = module.getMethod('start');
             let body = start.body.body;
             let expression = body[0].expression
             var type = expression.type();
             var ctx =expression.getContext();
             expect(`Promise<any>`).toBe( ctx.apply(type).toString().replace(/[\s\r\n]/g,'') );

            // expression = body[2].declarations[0];
            // type = expression.type();
            // ctx =expression.getContext();
            // expect(`{name:string,age:int}[]`).toBe( ctx.apply(type).toString().replace(/[\s\r\n]/g,'') );
            
        });

        it('should compiler error', function() {
            // const result=(code,line,kind=0)=>{
            //     const error = errors.find( item=>{
            //         return item.code===code && item.kind === kind && (item.range.start.line) === line
            //     });
            //     const index = errors.indexOf(error);
            //     if( index >= 0 ){
            //         errors.splice(index,1);
            //     }
            //     return error ? error.message : 'Not found error';
            // }
            // expect(`Type 'boolean' is not assignable to assignment of type 'string[]'`).toEqual( result(1009,8) );
            // expect(`Type 'uint' is not assignable to assignment of type 'unknown'`).toEqual( result(1009,15) );

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