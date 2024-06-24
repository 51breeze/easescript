const fs = require('fs')
const path = require('path')
const TestUtils = require("./TestUtils");
const Compiler = require("../lib/core/Compiler");
const Diagnostic = require("../lib/core/Diagnostic");
const Compilation = require("../lib/core/Compilation");
const _compiler = new Compiler(Object.assign({
    debug:true,
    throwParseError:true,
    lang:'en-US',
    diagnose:true,
    enableComments:true,
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
            path.join(__dirname,"node/index.d.es")
        ],{scope:'local',inherits:[]});
    }
}


describe('compile file', function(){
    beforeAll(async function() {
        await ready()
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