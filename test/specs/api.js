const compiler = require("../compiler");
const TestUtils = require("../TestUtils");

describe('test tabel', function() {
    const creator = new compiler.Creator();
    let compilation = null;
    let compilation2 = null;
    let compilation3 = null;
    let errors = [];
    let module = null;
    let errorNum = 0;
    beforeAll(async function() {
        compilation = await creator.startByFile('api/Index.es');
        compilation2 = await creator.startByFile('front/Admin.es');
        compilation3 = await creator.startByFile('com/Person.es');
        errors = compilation.errors;
        errors.push( ...compilation2.errors )
        errorNum = errors.length;
        module = compilation.getModuleById("api.Index");
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

        expect(true).toBe( compilation.compiler.scopeManager.checkDocumentor('thinkphp', compilation ) );
        expect(false).toBe( compilation.compiler.scopeManager.checkDocumentor('php', compilation2 ) );
        expect(true).toBe( compilation.compiler.scopeManager.checkDocumentor('vue', compilation2 ) );
        expect(true).toBe( compilation.compiler.scopeManager.checkDocumentor('vue', compilation3 ) );
        expect(true).toBe( compilation.compiler.scopeManager.checkDocumentor('php', compilation3 ) );

    });

});
