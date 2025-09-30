const fs = require('fs')
const path = require('path')
const TestUtils = require("./TestUtils");
const {Compiler, Diagnostic, Compilation} = require("../dist/index.cjs");
const _compiler = new Compiler(Object.assign({
    debug:true,
    throwParseError:true,
    lang:'en-US',
    diagnose:true,
    enableComments:true,
    autoLoadDescribeFile:false,
    output:path.join(__dirname,"./build"),
    workspace:path.join(__dirname,"./src"),
    parser:{
        locations:true
    }
},{}));


let initialize = false;
async function ready(){
    if( !initialize ){
        initialize = true;
        await _compiler.initialize();
        await _compiler.loadTypes([
            path.join(__dirname,"node-typings/index.d.es")
        ],{scope:'local',inherits:[]});
    }
}


describe('compile file', function(){
    let compilation = null;
    beforeAll(async function() {
        await ready()
        compilation =await _compiler.createCompilation(_compiler.getFileAbsolute('TestNodeJs.es'));
        compilation.pluginScopes.scope = 'local';
        await compilation.parserAsync();
    });

    afterAll(()=>{
        _compiler.errors.forEach( item=>{
            if( item.kind <= 1){
               // fail( item.toString() )
            }
        });
    })

    it('should compile success and build', async function() {
        const errors = _compiler.errors;
        expect('Expected 0 errors').toContain(errors.filter(item=>item.kind===0||item.kind===1).length );
    })


});