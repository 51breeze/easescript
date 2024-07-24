const Stack = require("../core/Stack");
const JSModule = require("../core/JSModule");
const DeclaratorScope = require("../scope/DeclaratorScope");
const Namespace = require("../core/Namespace");
class ModuleDeclaration extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        scope = new DeclaratorScope(scope);
        super(compilation,node,scope,parentNode,parentStack);
        this.isModuleDeclaration= true;
        this._metatypes = [];
        this._annotations = [];
        this.id = this.createTokenStack( compilation, node.id, scope, node, this );
        this.body=[];
        this.exports = [];
        this.externals = [];
        this.imports = [];
        this.annotations = [];
        if(!(parentStack.isProgram || parentStack.isModuleDeclaration || parentStack.isExportNamedDeclaration)){
            this.id.error(1180, this.id.value())
        }
        compilation.hasDeclareJSModule = true;
        const id = this.id.value();
        let module = null;
        if(node.type==='NamespaceDeclaration'){
            this.isNamespaceDeclaration = true;
            if(this.id.isMemberExpression && parentStack.isNamespaceDeclaration){
                this.id.error(1197)
            }else{
                let result = id==="global" || !this.module ? JSModule.getNamespace(id, this.namespace) : JSModule.createModuleFromNamespace(id, this.module, this.compilation);
                if(result.isNamespaceModule){
                    module = result;
                    module.addStack(this);
                    this.namespace = module.namespace;
                }else{
                    this.namespace = result;
                    this.compilation.namespace = result;
                }
            }
        }else{
            module = JSModule.createModule(id, this.compilation)
            this.namespace = module.namespace;
            module.addStack(this)
        }
        this.module = module;

        const annotations = this.annotations;
        const metatypes = this.metatypes;
        const imports =this.imports;
        const exports =this.exports;
        const externals =this.externals;

        node.body.forEach( (item,index)=>{
            const stack = this.createTokenStack( compilation, item, scope, node, this );
            if(stack.isAnnotationDeclaration ){
                const annotationStack = this.interceptAnnotation( stack )
                if(annotationStack){
                    annotations.push( annotationStack );
                }
            }else if(stack.isImportDeclaration ){
                imports.push( stack );
            }else if( stack.isExportAllDeclaration || stack.isExportDefaultDeclaration || stack.isExportNamedDeclaration || stack.isExportAssignmentDeclaration){
                exports.push( stack );
            }else{
                stack.metatypes = metatypes.splice(0,metatypes.length);
                stack.annotations = annotations.splice(0,annotations.length);
                if( 
                    stack.isModuleDeclaration || 
                    stack.isClassDeclaration || 
                    stack.isEnumDeclaration || 
                    stack.isInterfaceDeclaration ||  
                    stack.isStructTableDeclaration ||  
                    stack.isDeclaratorDeclaration || 
                    stack.isDeclaratorVariable || 
                    stack.isDeclaratorFunction   || 
                    stack.isTypeStatement ||
                    stack.isDeclaratorTypeAlias
                ){
                    this.body.push(stack);
                    if(module){
                        if( stack.isNamespaceDeclaration ){
                            if(stack.module){
                                module.addDescriptor(stack.value(), stack);
                            }
                        }else if(stack.isModuleDeclaration){
                            const pp = this.getParentStack( stack=>stack.isModuleDeclaration, true);
                            if(pp && pp.isModuleDeclaration && pp.module){
                                pp.module.addJSModuleRefs(stack.module)
                            }
                        }else{
                            if(stack.isDeclaratorFunction || stack.isDeclaratorVariable){
                                module.addDescriptor(stack.value(), stack);
                            }else{
                                module.setType(stack.value(), stack);
                            }
                        }
                    }
                }else{
                    externals.push(stack);
                }
            }
        });
    }

    type(){
        if(this.module){
            return this.module.getExportObjectType();
        }
        return Namespace.globals.get('never');
    }

    description(){
        return this;
    }

    definition(ctx){
        const kind = this.isNamespaceDeclaration ? 'namespace' : 'module';
        let id = this.id.value()
        if(!this.isNamespaceDeclaration){
            id = `"${id}"`;
        }
        return {
            kind,
            text:`${kind} ${id}`,
            location:this.id.getLocation(),
            file:this.file
        }
    }

    set metatypes(value){
        value.forEach( item=>{
            item.additional = this;
        })
        this._metatypes = value;
    }

    get metatypes(){
       return this._metatypes;
    }

    set annotations(value){
        value.some( (annotation)=>{
            annotation.additional = this;
        });
        this._annotations = value;
    }

    get annotations(){
        return this._annotations;
    }

    freeze(){
        super.freeze(this);
        super.freeze(this.id);
        super.freeze(this.body);
        this.body.forEach(stack=>stack.freeze());
    }

    async createCompleted(){
        if(this.imports.length>0){
            await this.compiler.callAsyncSequence(this.imports, async(stack)=>{
                await stack.addImport();
            });
        }
        if(this.body.length>0){
            await Promise.allSettled(this.body.map( item=>item.createCompleted()));
        }
        if(this.exports.length>0){
            await this.allSettled(this.exports, async(stack)=>await stack.createCompleted());
        }
    }

    checkDepend(module, depModule){
        return depModule.extends.concat(depModule.implements).some( depModule=>{
            if(depModule === module)return true;
            return this.checkDepend(module,depModule);
        });
    }

    value(){
        return this.id.value();
    }

    parser(){
        if(super.parser()===false)return false;
        try{
            this.imports.forEach( stack=>stack.parser() );
            this.body.forEach(item=>{
                item.parser();
            })
            this.exports.forEach( stack=>{
                stack.parser()
            });
            this.externals.forEach( stack=>stack.parser() )
        }catch(e){
            console.error(e)
        }
    }
    
}

module.exports = ModuleDeclaration;