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
        this.isGlobalNamespace = false;
        if(node.type==='NamespaceDeclaration'){
            this.namespace = JSModule.getNamespace(id, this.namespace)
            module = JSModule.createModuleFromNamespace(id, this.module);
            this.namespace.modules.set(id, module)
            this.isGlobalNamespace = this.namespace === JSModule.getNamespace();
        }else{
            this.namespace = JSModule.getNamespace()
            module = JSModule.get(id);
            if(!module){
                module = new JSModule(compilation, id);
                JSModule.set(id, module);
            }
        }

        module.addStack(this)
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
                    stack.isNamespaceDeclaration || 
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
                    if( stack.isNamespaceDeclaration ){
                        if(!stack.isGlobalNamespace){
                            module.addDescriptor(stack.value(), stack);
                        }
                    }else if(!stack.isTypeStatement){
                        if(stack.isDeclaratorFunction || stack.isDeclaratorVariable){
                            module.addDescriptor(stack.value(), stack);
                        }else{
                            module.setType(stack.value(), stack);
                        }
                        if(this.isGlobalNamespace){
                            Namespace.dataset.set(stack.value(), stack);
                        }
                    }
                }else{
                    externals.push(stack);
                }
            }
        });
    }

    type(){
        return this.module.getExportObjectType();
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
            range:this.id.getLocation(),
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
            await this.compiler.callAsyncSequence(this.imports, async(stack)=>await stack.addImport());
        }
        if(this.body.length>0){
            await Promise.allSettled(this.body.map( item=>item.createCompleted()));
        }
        if(this.exports.length>0){
            await this.allSettled(this.exports, async(stack)=>await stack.createCompleted());
        }
        let exportDefault = null;
        const module = this.module;
        this.exports.forEach( stack=>{
            if(stack.isExportDefaultDeclaration){
                exportDefault = stack;
            }else if(stack.isExportAllDeclaration || stack.isExportNamedDeclaration){
                stack.getAllExportDescriptors().forEach( (value, key)=>{
                    if(value.isLiteral && value.isStack && value.value() === null){
                        module.del(key)
                    }else{
                        module.set(key, value)
                    }
                });
            }else if(stack.isExportAssignmentDeclaration){
                if(this.exports.length>1){
                    stack.error(1192)
                }else{
                    module.set('*', stack)
                    if(stack.expression.isIdentifier){
                        const items = module.descriptors.get(stack.expression.value());
                        if(items && items.length>1){  
                            items.forEach( desc=>{
                                if(desc.isModuleDeclaration){
                                    let owner = desc.module;
                                    owner.types.forEach((desc, key)=>{
                                        owner.set(key, desc.type())
                                    });
                                    owner.descriptors.forEach(([desc],key)=>{
                                        owner.set(key, desc)
                                    });
                                }
                            })
                        }
                    }
                }
            }
        });
        if(exportDefault){
            if(exportDefault.declaration.value() === null){
                module.del('default');
            }else{
                const desc = exportDefault.description();
                if(desc){
                    module.set('default', desc);
                }
            }
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
        this.body.forEach(item=>{
            item.parser();
        })
        this.imports.forEach( stack=>stack.parser() );
        this.exports.forEach( stack=>{
            stack.parser()
        });
        this.externals.forEach( stack=>stack.parser() )
    }
    
}

module.exports = ModuleDeclaration;