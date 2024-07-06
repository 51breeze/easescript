const compiler = require("../compiler");
const TestUtils = require("../TestUtils");
const path = require("path");
describe('test components Child', function() {
    const creator = new compiler.Creator();
    let compilation = null;
    let compilation2 = null;
    let compilation3 = null;
    let errors = [];
    let module = null;
    let errorNum = 0;
    beforeAll(async function() {
        compilation = await creator.startByFile('./node.es');
        compilation2 = await creator.startByFile('./../assert.d.es');
        compilation3 = await creator.startByFile('./../process.d.es');
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

        compilation3.errors.forEach( item=>{
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
         if(Array.isArray(def))def = def[0];
         expect(def.expre).toContain('(alias) function assert<T = any>(value: T, message?: string | Error): T')
         expect('assert.d.es').toEqual( path.basename(def.file) )

         def = expression.specifiers[1].toDefinition();
         if(Array.isArray(def))def = def[0];
         expect(def.expre ).toContain('(alias) class assert.AssertionError')
         expect('assert.d.es').toEqual( path.basename(def.file) )

         def = expression.specifiers[2].toDefinition();
         if(Array.isArray(def))def = def[0];
         expect(def.expre).toContain('(alias) function exit(): void')
         def =  expression.specifiers[2].description();
         
         expect('ImportSpecifier').toEqual( def.toString() )

         def = def.description();
         expect('process.d.es').toEqual( path.basename(def.file) )

         def = expression.specifiers[3].toDefinition();
         if(Array.isArray(def))def = def[0];
         expect(def.expre).toContain('import child')
         expect(def.expre).toContain('(local const) child:[]')


         expression = start.childrenStack[1].expression
         expect('ImportDefaultSpecifier').toEqual( expression.description().toString() )
         expect('<T = any>(value: T, message?: string | Error)=>T').toEqual( expression.description().type().toString() )

         expression = start.childrenStack[2].expression
         expect(true).toBeTrue( expression.description().isModule )
         expect('assert.AssertionError').toEqual( expression.type().toString() )

         def = start.childrenStack[3].specifiers[0].toDefinition();
         if(Array.isArray(def))def = def[0];
         expect(def.expre).toContain('import config')
         expect(def.expre).toContain('(local const) config:{}')

         def = start.childrenStack[4].specifiers[0].toDefinition();
         if(Array.isArray(def))def = def[0];
         expect(def.expre).toContain('(local const) database:string')
         expect(def.expre).toContain('import database')


         def = start.childrenStack[4].specifiers[1].toDefinition();
         if(Array.isArray(def))def = def[0];
         expect(def.expre).toContain('(alias) function test(val: string): boolean')
         expect(def.expre).toContain('import test')

         def = start.childrenStack[4].specifiers[2].description()
         expect(true).toBeTrue( def.type().isLiteralObjectType )

         expect('string').toEqual( def.type().attribute('site').type().toString())

         expression = start.childrenStack[5].expression
         expect('<uint>(value: uint, message?: string | Error)=>uint').toEqual( expression.descriptor().toString(expression.getContext()))

        
    });

});
