const compiler = require("../compiler");
const TestUtils = require("../TestUtils");

describe('test tabel', function() {
    const creator = new compiler.Creator();
    let compilation = null;
    let errors = [];
    let module = null;
    let errorNum = 0;
    beforeAll(async function() {
        compilation = await creator.startByFile('Address.es');
        errors = compilation.errors;
        errorNum = errors.length;
        module = compilation.getModuleById("Address");
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

        const status = module.getMember('status');
        expect('com.Types').toEqual( status.type().toString() )

        const type = module.getMember('type');
        expect('1 | 2 | 3').toEqual( type.type().toString(null, {toLiteralValue:true}) )

    });

});
