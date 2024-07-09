const AutoImporter = require("../core/AutoImporter");
const Namespace = require("../core/Namespace");
const Stack = require("../core/Stack");
class ExportDefaultDeclaration extends Stack {
    constructor(compilation,node,scope,parentNode,parentStack){ 
        super(compilation,node,scope,parentNode,parentStack);
        this.isExportDefaultDeclaration = true;
        this.declaration = this.createTokenStack(compilation, node.declaration, scope, node, this);
        if( parentStack && !(parentStack.isProgram || parentStack.isPackageDeclaration || parentStack.isModuleDeclaration) ){
            this.error(1159);
        }
        let _exports = null
        if(parentStack.isModuleDeclaration && parentStack.module){
            _exports = parentStack.module.exports;
        }else if(this.compilation.isDescriptorDocument()){
            _exports = this.namespace.exports;
        }
        if(_exports){
            const key = 'default';
            if(_exports.has(key)){
                this.declaration.error(1195, key, this.namespace.toString())
            }else{
                _exports.set(key, this)
            }
        }
    }
    freeze(){
        this.declaration.freeze();
    }
    reference(){
        return this.description().reference();
    }
    referenceItems(){
        return this.description().referenceItems();
    }
    definition(){
        const desc = this.description();
        if(desc && !desc.isLiteral){
            return desc.definition();
        }
    }
    description(){
        return this.declaration.description();
    }
    descriptor(){
        let desc = this.description();
        if(desc.isClassDeclaration || 
            desc.isDeclaratorDeclaration || 
            desc.isEnumDeclaration || 
            desc.isInterfaceDeclaration || 
            decl.isTypeStatement ||
            decl.isDeclaratorTypeAlias ||
            desc.isStructTableDeclaration
        ){
            return decl.type();
        }else if(desc.isNamespaceDeclaration){
            return desc.module
        }
        if(this.is(desc))return desc.descriptor();
        return desc;
    }

    value(){
        return this.declaration.value();
    }
    raw(){
        return this.declaration.raw();
    }
    type(){
        return this.description().type();
    }
    async createCompleted(){
        if(this.declaration){
            await this.declaration.createCompleted();
            if(this.parentStack.isPackageDeclaration && this.declaration.isIdentifier && this.compilation.isDescriptorDocument()){
                const desc = this.declaration.description();
                if(desc){
                    if(desc.isImportDefaultSpecifier || desc.isImportNamespaceSpecifier || desc.isImportSpecifier){
                        if(desc.parentStack.isImportDeclaration){
                            const jsModule = desc.parentStack.getResolveJSModule();
                            if(jsModule){
                                let key = this.declaration.value();
                                let value = AutoImporter.create(jsModule.id, key, key);
                                value.origin = this;
                                this.namespace.imports.set(key, value)
                            }
                        }
                    }
                }
            }
        }
    }
    parser(){
        if(super.parser()===false)return false;
        if(this.compilation.stack.exports.length > 0 ){
            const result = this.compilation.stack.exports.filter( item=>item.isExportDefaultDeclaration );
            if( result.length > 1 ){
                this.error(1163);
            }
        }
        if(this.declaration){
            this.declaration.parser();
            this.declaration.setRefBeUsed();
        }
    }
}

module.exports = ExportDefaultDeclaration;