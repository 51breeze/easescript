const fs = require('fs')
const path = require('path')
const compiler = require("./compiler");
const root = path.join(__dirname,'./specs');

const specs = fs.readdirSync( root );
specs.forEach(file=>require(path.join(root,file)));

// require( path.join(root,'bug1.js') )
// require( path.join(root,'bug2.js') )
// require( path.join(root,'spe-v2.js') )
// require( path.join(root,'spe1.js') )
// require( path.join(root,'spe2.js') )
// require( path.join(root,'spe3.js') )
// require( path.join(root,'spe4.js') )
// require( path.join(root,'spe5.js') )
// require( path.join(root,'spe6.js') )
// //require( path.join(root,'spe7.js') )

describe('compile file', function() {
    const creator = new compiler.Creator();
    let compilation = null;
    let errors = [];
    let module = null;
    beforeAll(async function() {
        compilation = await creator.startByFile('./Test.es');
        errors = compilation.compiler.errors;
    });

    afterAll(()=>{
        errors.forEach( item=>{
            if( item.kind == 0 ){
                fail( item.toString() )
            }
        });
        compilation = null;
    })

    it('should compile success and build', async function() {
       
        expect('Expected 0 errors').toContain( errors.length );
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
        
    })
    
});


