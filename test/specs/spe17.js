const compiler = require("../compiler");
const TestUtils = require("../TestUtils");
describe('test components Child', function() {
    const creator = new compiler.Creator();
    let compilation = null;
    let errors = [];
    let module = null;
    let errorNum = 0;
    beforeAll(async function() {
        compilation = await creator.startByFile('./Gen.es');
        errors = compilation.errors;
        errorNum = errors.length;
        module = compilation.getModuleById("Gen");
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
        const getAddress = module.getMember('getAddress');
        expect('(method) public Gen.getAddress(name: number): number').toEqual( getAddress.hover(getAddress.getContext()).text )
    });

});
