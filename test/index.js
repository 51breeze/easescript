const fs = require('fs')
const path = require('path')
const compiler = require("./compiler");
const root = path.join(__dirname,'./specs');
const specs = fs.readdirSync( root );
specs.forEach(file=>require(path.join(root,file)));

describe('compile file', function() {
    const creator = new compiler.Creator();
    creator.startByFile("./Test.es").then( compilation=>{
        it('should compile success and build', function() {
            const errors = compilation.compiler.errors;
            expect('Expected 0 errors').toContain( errors.length );
            if( errors.length===0 ){

               const jsxElement = compilation.getReference('jsxElement',  compilation.getModuleById('Test') );
               var stack = jsxElement.body.body[1].declarations[0].init
               expect('JSXElement').toEqual( stack.node.type );
               expect('JSXOpeningElement').toEqual( stack.openingElement.node.type );
               expect(true).toEqual( stack.openingElement.name.isJSXIdentifier );
               expect('JSXClosingElement').toEqual( stack.closingElement.node.type );
               expect( true ).toEqual( Array.isArray( stack.children ) );
               stack = jsxElement.body.body[2].declarations[0].init;
               expect([]).toEqual( stack.openingElement.attributes );
               expect('div').toEqual( stack.openingElement.name.value() );
                
            }else{
                errors.forEach((error)=>{
                    fail( error.toString() );
                });
            }
        });
    }).catch( error=>{
        const errors=error.errors;
        it(`compiler failed 'Test.es'`, function() {
            errors.forEach((error)=>{
                fail( error.message );
                console.log(error)
            });
        });
    });
    
});


