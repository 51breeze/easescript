const Stack = require("../core/Stack");
const Utils = require("../core/Utils");
class JSXScript extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isJSXScript= true;
        this.jsxElement = this;
        this.body = [];
        this.hasClassDeclared = false;
        this.isScriptProgram = true;
        if( !this.compilation.JSX ){
            this.error(1109);
        }

        this.openingElement = this.createTokenStack( compilation, node.openingElement, scope, node, this );
        this.closingElement = this.createTokenStack( compilation, node.closingElement, scope, node, this );

        if( !(parentStack.isJSXElement && parentStack.isComponent && parentStack.jsxRootElement === parentStack) ){
            //this.error(1109);
            this.isScriptProgram = false;
        }

        if( !this.isScriptProgram ){
            node.children.forEach( item=>{
                const stack = this.createTokenStack(compilation, item, this.scope, node, this);
                this.body.push( stack );
            });
        }else{
            const annotations = [];
            const metatypes = [];
            const imports = [];
            node.children.forEach( item=>{
                const stack = this.createTokenStack(compilation, item, this.scope, node, this);
                if( stack ){
                    if( stack.isMetatypeDeclaration ){
                        metatypes.push(stack);
                    }else if( stack.isAnnotationDeclaration ){
                        const _stack = this.interceptAnnotation(stack)
                        if( _stack ){
                            annotations.push(_stack);
                        }
                    }else if(stack.isImportDeclaration ){
                        imports.push( stack );
                    }else{
                        stack.annotations = annotations.splice(0, annotations.length);
                        stack.metatypes = metatypes.splice(0, metatypes.length);
                        if( stack.isClassDeclaration ){
                            this.hasClassDeclared = true;
                            this.module = stack.module;
                            stack.imports = imports.splice(0, imports.length);
                        }
                        this.body.push(stack);
                    }
                }
            });

            this.imports = imports;
            if( annotations.length > 0 ){
                annotations.forEach(item=>{
                    item.error(1093);
                });
            }

            if( metatypes.length > 0 ){
                metatypes.forEach(item=>{
                    item.error(1093);
                });
            }

            if( this.hasClassDeclared ){
                this.body.forEach(stack=>{
                    stack.createCompleted && stack.createCompleted();
                });
            }

            this.imports.forEach( stack=>{
                stack.parser();
                stack.addImport(this.module, this.parentStack.scope);
            });

            if( !this.hasClassDeclared ){
                this.compilation.addModuleStack(this.module,this);
            }
          
        }
    }

    freeze(){
        super.freeze();
        super.freeze(this.scope);
        super.freeze(this.body);
        this.body.forEach(stack=>stack.freeze());
    }
    parser(){
        if( !super.parser() )return false;
        if( this.isScriptProgram ){
            this.compilation.stack.scripts.push( this );
            if( this.hostComponentAnnotation ){
                const pDesc = this.parentStack.description();
                const declare = pDesc && pDesc.getModuleGenerics();
                const args = this.hostComponentAnnotation.getArguments();
                if( declare && args[0] ){
                    const refsModule = this.getModuleById( args[0].value );
                    if( refsModule ){
                        if( declare[0].hasConstraint && !declare[0].check(refsModule) ){  
                            args[0].stack.error(1003, refsModule.toString(), declare[0].toString() );
                        }else{
                            if( Utils.checkDepend(this.module,refsModule) ){
                                args[0].stack.error(1024,args[0].value, this.module.getName(), refsModule.getName());
                            }else if(this.module && this.module.isModule){
                                const stackModule = this.module.moduleStack;
                                if( stackModule ){
                                    const ctx = stackModule.getContext();
                                    ctx.extractive( declare[0], refsModule);
                                }
                            }
                        }
                    }
                }
            }
        }

        this.body.forEach(item =>{
            item.parser();
        });

        return true;
    }
}

module.exports = JSXScript;