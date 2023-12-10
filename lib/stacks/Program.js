const Stack = require("../core/Stack");
const ClassScope = require("../scope/ClassScope");
const Namespace = require("../core/Namespace");
class Program extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isProgram= true;
        this.externals = [];
        this.exports = [];
        this.imports = [];
        this.body = [];
        this.isJSXProgram = false;
        const first = node.body[0];
        if( first && first.type ==="ExpressionStatement" && first.expression.type ==="JSXElement"){
            this.compilation.JSX = true;
            this.isJSXProgram = true;
            this.createJsx(node.body);
        }else{
            this.create(node.body);
        }
    }

    createJsx(body){

        const originId = this.compilation.originId;
        const segments = originId ? originId.split('.') : null;
        let className = null;
        if( segments ){
            className = segments.pop();
            this.namespace = Namespace.create( segments.join('.') );
        }else{
            className = this.compiler.getFileClassName( this.file );
            this.namespace = Namespace.create( this.compiler.getFileNamespace( this.file ) );
        }

        this.module = this.compilation.createModule(this.namespace, className);
        this.module.isClass = true;
        this.module.isLocalModule = true;
        this.module.jsxDeclaredSlots = new Map();
        this.scope =  new ClassScope( this.scope );
        this.compilation.addModuleStack(this.module,this);
        this.scripts = [];
        body.forEach( item=>{
            if( item.type === "ExpressionStatement" ){
                const stack = this.createTokenStack(this.compilation, item.expression, this.scope, this.node, this);
                if( stack && stack.jsxElement ){
                    this.body.push(stack);
                    const inherit = stack.getInheritModule();
                    if(!this.module.inherit && inherit ){
                        this.module.extends = inherit;
                    }
                }
            }else{
                this.compilation.error( item , 1110);
            }
        });
        if( this.body.length != 1 ){
            this.error(1123);
        }
    }

    create( body ){
        const annotations = [];
        const metatypes = [];
        const imports = [];
        const importExternals = [];
        body.forEach( item=>{
            const stack = this.createTokenStack(this.compilation, item, this.scope, this.node, this);
            if( stack ){
                if( stack.isMetatypeDeclaration ){
                    metatypes.push(stack);
                    this.body.push(stack);
                }else if( stack.isAnnotationDeclaration ){
                    const annotationStack = this.interceptAnnotation( stack );
                    if(annotationStack){
                        annotations.push( annotationStack );
                    }
                    this.body.push(stack);
                }else if(stack.isImportDeclaration ){
                    imports.push( stack );
                    this.body.push(stack);
                }else if( stack.isExportAllDeclaration || stack.isExportDefaultDeclaration || stack.isExportNamedDeclaration ){
                    this.exports.push( stack );
                    this.body.push(stack);
                }
                else if( stack.isPackageDeclaration || 
                    stack.isClassDeclaration   || 
                    stack.isDeclaratorDeclaration || 
                    stack.isEnumDeclaration      || 
                    stack.isInterfaceDeclaration ||
                    stack.isStructTableDeclaration ||
                    stack.isDeclaratorVariable   || 
                    stack.isDeclaratorFunction   || 
                    stack.isTypeStatement ||
                    stack.isDeclaratorTypeAlias 
                ){
                    stack.annotations = annotations.splice(0, annotations.length);
                    stack.metatypes = metatypes.splice(0, metatypes.length);
                    stack.imports = imports.splice(0,imports.length);
                    if( stack.imports.length >0 && 
                        !(stack.isClassDeclaration || 
                            stack.isEnumDeclaration || 
                            stack.isInterfaceDeclaration || 
                            stack.isDeclaratorDeclaration || 
                            stack.isStructTableDeclaration
                        )){
                        
                        stack.imports.forEach( item=>!item.source.isLiteral && item.error(1094) );
                    }
                    this.body.push(stack);
                }else{
                    const imps = imports.splice(0,imports.length);
                    importExternals.push( ...imps );
                    this.externals.push(stack);
                }
            }
        });

        if( importExternals.length > 0 ){
            this.externals.unshift( ...importExternals );
        }

        if(imports.length>0){
            this.imports.push( ...imports.splice(0,imports.length) )
        }

        this.annotations = annotations.splice(0, annotations.length);
        this.annotations.forEach(item=>{
            item.additional = this;
        });
        this.metatypes = metatypes.splice(0, metatypes.length);
        this.metatypes.forEach(item=>{
            item.additional = this;
        });
    }

    async createCompleted(){
        if( this._createCompletedFlag )return;
        this._createCompletedFlag = true;
        await this.allSettled(this.body, async(stack)=>await stack.createCompleted() )
        const asyncImports = [];
        this.imports.map( (stack)=>{
            if( stack.isImportDeclaration ){ 
                asyncImports.push(stack.addImport())
            }
        });
        this.externals.forEach( stack=>{
            if( stack.isImportDeclaration ){       
                asyncImports.push(stack.addImport())
            }
        });
        await this.allSettled(asyncImports, async(promise)=>await promise);
    }
    
    freeze(){
        super.freeze(this);
        super.freeze(this.scope);
        super.freeze(this.body);
        this.body.forEach(stack=>stack.freeze());
        this.externals.forEach(stack=>stack.freeze());
    }

    async parserAsync(){
        this.parser();
    }
    
    parser(){
        if(super.parser()===false)return false;
            
        this.metatypes.forEach(item=>{
            item.parser();
        })
        this.annotations.forEach(item=>{
            item.parser();
        })

        if( this.exports.length > 0 && this.compilation.modules.size > 0 ){
            this.exports.forEach( item=>item.warn(1160) )
        }

        this.imports.forEach(item=>{
            item.parser();
        })

        this.body.forEach(item=>{
            //if( !(item.isMetatypeDeclaration || item.isExportAllDeclaration || item.isExportDefaultDeclaration || item.isExportNamedDeclaration) ){
                item.parser();
            //}
        })

        this.externals.forEach(item=>{
            item.parser();
        });

        this.exports.forEach(item=>{
            item.parser();
        });
    }
}

module.exports = Program;