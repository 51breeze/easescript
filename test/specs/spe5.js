const compiler = require("../compiler");
describe('test MergeTypes', function() {

    const creator = new compiler.Creator();
    let compilation = null;
    let errors = [];
    let module = null;
    beforeAll(async function() {
        compilation = await creator.startByFile('./test/MergeTypes.es');
        errors = compilation.compiler.errors;
        module = compilation.getModuleById("test.MergeTypes");
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
        expect(`{
            a: ({
                    s: (string | (uint | string[])[] | uint)[],
                    d: {
                            a: string,
                            b: string,
                            d: string,
                            e: (string | (uint | string[])[] | uint)[],
                            f: {
                                    a: string,
                                    b: string,
                                    c: {
                                            a: string
                                    }
                            }
                    }
            } | (string | (uint | string[])[] | uint)[])[],
            c: string,
            d: string,
            e: uint
        }`.replace(/(\r\n|\s)+/g,'') ).toBe( expression.getTypeDisplayName( expression.type() ).replace(/(\r\n|\s)+/g,'') );
        
    });

});