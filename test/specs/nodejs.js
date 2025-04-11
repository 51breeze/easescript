const compiler = require("../compiler");
const TestUtils = require("../TestUtils");
const path = require("path");
describe('test TestNodeJsImport', function() {
    const creator = new compiler.Creator();
    let compilation = null;
    let errors = [];
    let module = null;
    let errorNum = 0;
    beforeAll(async function() {
        compilation = await creator.startByFile('./TestNodeJsImport.es');
        module = compilation.getModuleById("TestNodeJsImport");
        errors = compilation.errors;
        errorNum = errors.length;
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

        const start = module.getMember('http');
        let body = start.body.body;
        let expression = body[0].declarations[0].init;

        expect('function createServer<IncomingMessage, ServerResponse<IncomingMessage>>(requestListener?: RequestListener<IncomingMessage, ServerResponse<IncomingMessage>>): Server<IncomingMessage, ServerResponse<IncomingMessage>>')
        .toEqual( expression.hover(expression.getContext()).text )

        expression = expression.arguments[0];

       let callExpression = expression.body.body[0].expression;
       expect('(statusCode: number, headers?: OutgoingHttpHeaders | (number | string | string[])[])=>this').toEqual( callExpression.callee.type().toString() )
        
    });

});
