const fs = require('fs')
const path = require('path')
const compiler = require("./compiler");
const root = path.join(__dirname,'./specs');
const Glob = require('../lib/core/Glob')
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



describe('Glob', function() {
    var globInstance = null;
    beforeAll(async function() {
        globInstance = new Glob()
    });

    it('test', function() {
        globInstance.addRule('****', 'test/{...}/{basename}')
        globInstance.addRule('**/*.json', 'json/{...}/{basename}')
        globInstance.addRule('test/**/*.es', 'test/{...}/../{basename}')
        globInstance.addRule('test/**/*.*', 'test/{...}/../all/{basename}')
        globInstance.addRule('test/dir/**/*.*', 'test/{0}/{1}-{2}/{basename}')
        globInstance.addRule('**/api/model/**/*.*', 'test/build/server/model/{...globs[0]}/{globs[1][1]}/{basename}')
        globInstance.addRule('**/apis/*/model/**/*.*', 'test/apis/server/model/{...globs[0]}/{globs[1]}/{globs[2]}/{basename}')
        globInstance.addRule('**/apis/*/*/*.js', 'test/js/{globs[1]}-{globs[2]}{basename}')
        globInstance.addRule('com/**/test', 'com/{...}/test/ok')
        
        globInstance.addRule('com/*/test/api/*', 'com/{...}/test/api/{1}')

        globInstance.addRule('com/*/test/api/**', 'coms/{0}/test/api/{globs[1]}/{filename}')
        globInstance.addRule('com/**/apis/**', 'comss/{-2}/{0}/test/api/{globs[1]}/{filename}')
        globInstance.addRule('element-ui/packages/***', 'element-plus/es/components/{...}/{filename}')

        expect('test/src/api/http/Index.es').toEqual( globInstance.dest('src/api/http/Index.es') )
        expect('test/src/api/Index.es').toEqual( globInstance.dest('test/src/api/http/Index.es') )
        expect('test/src/api/all/Index.js').toEqual( globInstance.dest('test/src/api/http/Index.js') )
        expect('test/build/server/model/test/com/test/Category.es').toEqual( globInstance.dest('test/com/api/model/category/test/Category.es') )
        expect('json/src/assets/front/met.json').toEqual( globInstance.dest('src/assets/front/met.json') )
        expect('test/dev/src-controller/http.es').toEqual( globInstance.dest('test/dir/dev/src/controller/http.es') )

        expect('test/apis/server/model/test/prod/person/test/com/Category.es').toEqual( globInstance.dest('test/prod/apis/person/model/test/com/Category.es') )
        expect('test/js/hash-prodindex.js').toEqual( globInstance.dest('test/prod/apis/hash/prod/index.js') )

        expect('com.test.http.test.ok').toEqual( globInstance.dest('com/test/http/test', {delimiter:'.'}) )
        expect('com.http.test.api').toEqual( globInstance.dest('com/http/test/api/dev', {delimiter:'.'}) )

        expect('coms.http.test.api.dev.cc.name').toEqual( globInstance.dest('com/http/test/api/dev/cc/name', {delimiter:'.'}) )
        expect('comss.dev.http.test.api.dev.cc.name').toEqual( globInstance.dest('com/http/test/apis/dev/cc/name', {delimiter:'.'}) )

        expect('element-plus/es/components/from').toEqual( globInstance.dest('element-ui/packages/from') )

    })

})



