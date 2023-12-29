const fs = require('fs')
const path = require('path')
const compiler = require("./compiler");
const root = path.join(__dirname,'./specs');

const specs = fs.readdirSync( root );
specs.forEach(file=>require(path.join(root,file)));

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
            if( item.kind == 0 && compilation.errors.includes(item) ){
                fail( item.toString() )
            }
        });
        compilation = null;
    })

    it('should compile success and build', async function() {
       
        expect('Expected 0 errors').toContain( compilation.errors.length );
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


