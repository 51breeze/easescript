const compiler = require("../compiler");
const code=`package specs{
    class Syntax{
        private var address:string = 'shen zhen';
        protected var name:string = '张三';
        public var success:boolean = false;
        constructor(){
            var b = 1;
            var data = {name:'name',age:5};
            var {name,age,...args} = data;
            var [address="ssss",...items] = this.getArray();
            var [item] = this.getData();
        }
        getData(a,...args){
            return {};
        }
        getArray(){
            return ['sss'];
        }
        shouldError(){
            const c=2;
            c = 5;
            let b:string = 'b';
            b = true;
            let d = this.declareGeneric<int,string>(1,1);
            d = this.declareGeneric(1,'1');
            let [tt,bb] = d;
            b = bb;
            tt.toFixed(0)

            var dd = <div><span>text</span></div>
            return <div><span>text</span></div>
        }
        declareGeneric<T,B=string>(t:T,b:B):[T,B]{
            return [t,b];
        }
    }
}`;

describe('compile syntax', function() {

    const creator = new compiler.Creator();
    let compilation = null;
    let errors = [];
    let module = null;

    beforeAll(async function() {
        compilation = await creator.startBySource(code);
        errors = compilation.compiler.errors;
        module = compilation.getModuleById("specs.Syntax");
    });

    afterAll(()=>{
        errors.forEach( item=>{
            if( item.kind == 0 ){
                fail( item.toString() )
            }
        });
        compilation = null;
    })

    it('should compiler success', function() {
        const stack = compilation.stack;
        expect( stack.isProgram ).toBeTrue();
        expect( stack.body[0].isPackageDeclaration ).toBeTrue();
        expect( stack.body[0].body[0].isClassDeclaration ).toBeTrue();

        const classStack = stack.body[0].body[0]
        expect( classStack.id.value() ).toBe("Syntax");
        expect( classStack.body[1].id.value() ).toBe("name");

        const methodStack = classStack.body[3];
        expect( methodStack.body.body[0].isVariableDeclaration ).toBeTrue();
        expect( methodStack.body.body[0].kind ).toBe("var");

        const spreadVar = methodStack.body.body[2];
        expect( spreadVar.declarations ).toBeInstanceOf(Array);
        expect( spreadVar.declarations[0].id.isObjectPattern ).toBeTrue();
        expect( spreadVar.declarations[0].id.properties ).toBeInstanceOf(Array);
        expect( spreadVar.declarations[0].id.properties.length ).toBe( 3 )
        expect( spreadVar.declarations[0].id.properties[2].isRestElement ).toBeTrue();
        spreadVar.declarations[0].id.properties.forEach( (item,index)=>{
            var names = ["name","age","args"]
            expect( item.value() ).toBe( names[index] );
        });

        const shouldError = module.getMember("shouldError");
        let stackNode = shouldError.expression.body.body[5];
        expect(`[uint,string]`).toEqual( stackNode.expression.right.type().toString() );
        
        stackNode = shouldError.expression.body.body[6];
        expect('string').toEqual( stackNode.declarations[0].id.elements[1].type().toString() );

        stackNode = shouldError.expression.body.body[9];
        expect('JSXElement').toEqual( stackNode.declarations[0].node.init.type);
        expect('JSXElement').toEqual( stackNode.declarations[0].node.init.children[0].type );

        stackNode = shouldError.expression.body.body[10];
        expect('JSXElement').toEqual( stackNode.node.argument.type );
        expect('JSXElement').toEqual( stackNode.node.argument.children[0].type );

    });

    it('should compiler error', function() {
        const result=(code,line,kind=0)=>{
            const error = errors.find( item=>{
                return item.code===code && item.kind === kind && (item.range.start.line+1) === line
            });
            const index = errors.indexOf(error);
            if( index >= 0 ){
                errors.splice(index,1);
            }
            return error ? line+' line' : 'no error';
        }
        expect("12 line").toEqual(result(1012,12));
        expect("12 line").toEqual(result(1000,12));
        expect("22 line").toEqual(result(1015,22));
        expect("24 line").toEqual(result(1009,24));
        expect("25 line").toEqual(result(1002,25));
    });
   
});