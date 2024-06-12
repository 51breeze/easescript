const compiler = require("../compiler");
const TestUtils = require("../TestUtils");
const path = require("path");
describe('test components Child', function() {
    const creator = new compiler.Creator();
    let compilation = null;
    let compilation2 = null;
    let errors = [];
    let module = null;
    let errorNum = 0;
    beforeAll(async function() {
        compilation = await creator.startByFile('./node.es');
        compilation2 = await creator.startByFile('./../assert.d.es');
        errors = compilation.errors;
        errorNum = errors.length;
    });

    afterAll(()=>{
        errors.forEach( item=>{
            if( item.kind == 0 ){
                fail( item.toString() )
            }
        });

        compilation2.errors.forEach( item=>{
            if( item.kind == 0 ){
                fail( item.toString() )
            }
        });

        compilation = null;
    })
    
    it('compiler success', function(){

         const start = compilation.stack;
         let expression = start.childrenStack[0];
         let def = expression.specifiers[0].toDefinition();
         expect('(import refers) assert: <T = any>(value: T, message?: string | Error)=>T').toEqual(def.expre)
         expect('assert.d.es').toEqual( path.basename(def.file) )

         def = expression.specifiers[1].toDefinition();
         expect('(import refers) class assert.AssertionError').toEqual(def.expre)
         expect('assert.d.es').toEqual( path.basename(def.file) )

         def = expression.specifiers[2].toDefinition();
         expect('(import refers) exit: ()=>void').toEqual(def.expre)
         def =  expression.specifiers[2].description();

         expect('ImportSpecifier').toEqual( def.toString() )

         def = def.description();
         expect('process.d.es').toEqual( path.basename(def.file) )

         def = expression.specifiers[3].toDefinition();
         expect('(import refers) child: []').toEqual(def.expre)


         expression = start.childrenStack[1].expression
         expect('ImportDefaultSpecifier').toEqual( expression.description().toString() )
         expect('<T = any>(value: T, message?: string | Error)=>T').toEqual( expression.description().type().toString() )

         expression = start.childrenStack[2].expression
         expect(true).toBeTrue( expression.description().isModule )
         expect('assert.AssertionError').toEqual( expression.type().toString() )

         def = start.childrenStack[3].specifiers[0].toDefinition();
         expect('(import refers) config: {}').toEqual( def.expre )

         def = start.childrenStack[4].specifiers[0].toDefinition();
         expect('(import refers) database: string').toEqual( def.expre )

         def = start.childrenStack[4].specifiers[1].toDefinition();
         expect('(import refers) test: (val: string)=>boolean').toEqual( def.expre )

         def = start.childrenStack[4].specifiers[2].description()
         expect(true).toBeTrue( def.type().isLiteralObjectType )

         expect('string').toEqual( def.type().attribute('site').type().toString())

         expression = start.childrenStack[5].expression
         expect('<uint>(value: uint, message?: string | Error)=>uint').toEqual( expression.getDeclareFunctionType(expression.description()).toString(expression.getContext()))

        
    });

});
