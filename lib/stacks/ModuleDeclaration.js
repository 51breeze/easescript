const Stack = require("../core/Stack");
class ModuleDeclaration extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
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

        if(!parentStack.isProgram){
            this.id.error(1180, this.id.value())
        }

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
                this.body.push(stack);
            }else if(stack.isImportDeclaration ){
                imports.push( stack );
                this.body.push(stack);
            }else if( stack.isExportAllDeclaration || stack.isExportDefaultDeclaration || stack.isExportNamedDeclaration ){
                exports.push( stack );
                this.body.push(stack);
            }else{
                stack.metatypes = metatypes.splice(0,metatypes.length);
                stack.annotations = annotations.splice(0,annotations.length);
                if( 
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
                    externals.push(stack);
                }
            }
        });

        // if( imports.length > 0 ){
        //     imports.push( ...imports );
        // }
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
        await Promise.allSettled(this.body.map( item=>item.createCompleted()));
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
        this.metatypes.forEach(item=>{
            item.parser();
        })
        this.annotations.forEach(item=>{
            item.parser();
        })
        this.body.forEach(item=>{
            item.parser();
        })
    }
    
}

module.exports = ModuleDeclaration;