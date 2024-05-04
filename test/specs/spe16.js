const compiler = require("../compiler");
const TestUtils = require("../TestUtils");
describe('test components Child', function() {
    const creator = new compiler.Creator();
    let compilation = null;
    let errors = [];
    let module = null;
    let errorNum = 0;
    beforeAll(async function() {
        compilation = await creator.startByFile('./components/Child.es');
        errors = compilation.errors;
        errorNum = errors.length;
        module = compilation.getModuleById("components.Child");
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
        const start = module.getMember('render');
        let body = start.body.body;
       // let expression = body[0].argument.children[0].children[0];
        //let attributes = expression.openingElement.attributes;
        //expect('{items:[string],name:string}').toEqual( attributes[0].type().toString().replace(/[\r\n\s]+/g,'') )
    });

});
