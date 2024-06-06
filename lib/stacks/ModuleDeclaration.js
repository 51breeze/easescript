const Stack = require("../core/Stack");
const JSModule = require("../core/JSModule");
const DeclaratorScope = require("../scope/DeclaratorScope");
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

        if(!(parentStack.isProgram || parentStack.isModuleDeclaration)){
            this.id.error(1180, this.id.value())
        }

        const id = this.id.value();
        let module = null;
        if(node.type==='NamespaceDeclaration'){
            module = parentStack.module.namespaces.get(id) || new JSModule(compilation, id)
        }else{
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
            }else if( stack.isExportAllDeclaration || stack.isExportDefaultDeclaration || stack.isExportNamedDeclaration ){
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
                        module.namespaces.set(stack.id.value(), stack.module)
                    }else{
                        if(stack.isDeclaratorFunction || stack.isDeclaratorVariable ){
                            module.addDescriptor(stack.value(), stack);
                        }else{
                            module.setType(stack.value(), stack.type());
                        }
                    }
                }else{
                    externals.push(stack);
                }
            }
        });
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
            await this.allSettled(this.imports, async(stack)=>await stack.addImport());
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

    definition(){
       return null;
    }

    parser(){
        if(super.parser()===false)return false;
        const module = this.module;
        this.body.forEach(item=>{
            item.parser();
        })
        this.imports.forEach( stack=>stack.parser() );
        let exportDefault = null;
        this.exports.forEach( stack=>{
            stack.parser()
            if(stack.isExportDefaultDeclaration){
                const desc = stack.description();
                if(desc){
                    exportDefault = desc;
                }
            }else if(stack.isExportAllDeclaration || stack.isExportNamedDeclaration){
                stack.getAllExportDescriptors().forEach( (value, key)=>{
                    module.set(key, value)
                });
            }
        });
        if(exportDefault){
            module.set('default', exportDefault);
        }
        this.externals.forEach( stack=>stack.parser() )
    }
    
}

module.exports = ModuleDeclaration;