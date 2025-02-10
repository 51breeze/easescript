const fs = require('fs')
const path = require('path')
const compiler = require("./compiler");
const root = path.join(__dirname,'./specs');
const TestUtils = require("./TestUtils");
const specs = fs.readdirSync( root );
specs.forEach(file=>require(path.join(root,file)));

describe('compile file', function() {
    const creator = new compiler.Creator();
    let compilation = null;
    let errors = [];
    let module = null;
    beforeAll(async function() {
        compilation = await creator.startByFile('./Test.es');
        if(compilation){
            errors = compilation.compiler.errors;
            module = compilation.getModuleById("Test");
        }
    });

    afterAll(()=>{

        errors.forEach( item=>{
            if( item.kind <= 1 && compilation.errors.includes(item) ){
                fail( item.toString() )
            }
        });
        compilation = null;
    })

    it('should compile success and build', async function() {
        if(!compilation)return;

        const errors = compilation.errors;
        
        let [error, result] = TestUtils.createError(errors,`'this[ns]' is not callable`, 1006);
        expect(error).toEqual(result);

        expect('Expected 0 errors').toContain(errors.filter(item=>item.kind===0||item.kind===1).length );
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


        const start = module.getMember('testGenerics');
        let body = start.body.body;
        expression = body[14].declarations[0].init

        // expect('object').toEqual(expression.type().toString())
        // expect('<string>(name: string)=>object').toEqual( expression.descriptor().type().toString(expression.getContext()))

       // const res = creator.compiler.parseResourceId({file:'/components/List.es'}, {index:0,type:'style',lang:'css','file.css':''})


        
    })
    
});



// describe('compile file', function() {
//     const creator = new compiler.Creator();
//     let compilation = null;
//     let errors = [];
//     let module = null;
//     beforeAll(async function() {
//         compilation = await creator.startByFile('./components/List.es');
//         if(compilation){
//             errors = compilation.compiler.errors;
//             module = compilation.getModuleById("Test");
//         }
//     });

//     afterAll(()=>{
//         errors.forEach( item=>{
//             if( item.kind <= 1 && compilation.errors.includes(item) ){
//                 //fail( item.toString() )
//             }
//         });
//         compilation = null;
//     })

//     it('should compile success and build', async function() {
//         if(!compilation)return;
//         expect('Expected 0 errors').toContain( compilation.errors.filter(item=>item.kind===0||item.kind===1).length );
//     })

    
// });