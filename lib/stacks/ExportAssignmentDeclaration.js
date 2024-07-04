const AutoImporter = require("../core/AutoImporter");
const JSModule = require("../core/JSModule");
const Module = require("../core/Module");
const Stack = require("../core/Stack");
class ExportAssignmentDeclaration extends Stack {
    constructor(compilation,node,scope,parentNode,parentStack){ 
        super(compilation,node,scope,parentNode,parentStack);
        this.isExportAssignmentDeclaration = true;
        this.expression = this.createTokenStack(compilation, node.expression, scope, node, this);
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
            const key = '*';
            if(_exports.has(key)){
                this.expression.error(1195, key, this.namespace.toString())
            }else{
                _exports.set(key, this)
            }
        }
    }
    freeze(){
        this.expression.freeze();
    }
    reference(){
        return this.expression().reference();
    }
    referenceItems(){
        return this.expression().referenceItems();
    }
    definition(ctx){
        if(this.expression.isIdentifier){
            let desc = this.descriptor();
            let owner = this.is(desc) ? desc.module : null;
            let compi = owner ? owner.compilation : null;
            let items = null;
            if(JSModule.is(owner)){
                items = owner.descriptors.get(this.expression.value());
            }else if(compi){
                items = desc.namespace.descriptors.get(this.expression.value());
            } 
            if(items && items.length > 1){
                return this.definitionMergeToArray(items.map(desc=>desc.definition(ctx)).filter(Boolean))
            }
        }
        const desc = this.description();
        if(desc && !desc.isLiteral){
            return desc.definition();
        }
        return null;
    }

    getExportNamespace(){
        let desc =  this.expression.descriptor();
        if(desc && desc.isExportAssignmentDeclaration){
            return desc.getExportNamespace();
        }
        if(this.expression.isIdentifier && JSModule.is(this.module)){  
            return this.module.namespaces.get(this.expression.value());
        }
        return null;
    }

    getExportType(){
        let desc =  this.expression.descriptor();
        if(desc && desc.isExportAssignmentDeclaration){
            return desc.getExportType();
        }
        if(this.expression.isIdentifier && JSModule.is(this.module)){  
            return this.module.getType(this.expression.value());
        }
        return null;
    }
    
    description(){
        let desc =  this.expression.description();
        if(!desc){
            if(this.expression.isMemberExpression){
                desc = this.expression.getReferenceType();
            }else if(this.expression.isIdentifier && this.parentStack.isModuleDeclaration){  
                desc = this.module.namespaces.get(this.expression.value());
            }
        }
        return desc;
    }
    descriptor(){
        const desc = this.description();
         if(desc){
            if(desc.isNamespaceDeclaration){
                return desc.module;
            }else if(desc.isClassDeclaration || 
                desc.isDeclaratorDeclaration || 
                desc.isNamespaceDeclaration || 
                desc.isEnumDeclaration ||
                desc.isInterfaceDeclaration || 
                desc.isTypeStatement ||
                desc.isDeclaratorTypeAlias ||
                desc.isStructTableDeclaration
            ){
                return desc.type();
            }
        }

        if(this.is(desc)){
            return desc.descriptor();
        }
        return desc;
    }

    getAllReferenceIdentifier(){
        if(this.expression.isIdentifier){
            return [this.expression];
        }
        return [];
    }

    value(){
        return this.expression.value();
    }
    raw(){
        return this.expression.raw();
    }
    type(){
        return this.expression.type();
    }
    async createCompleted(){
        await this.expression.createCompleted();
        if(this.parentStack.isPackageDeclaration && this.expression.isIdentifier && this.compilation.isDescriptorDocument()){
            const desc = this.expression.description();
            if(desc){
                if(desc.isImportDefaultSpecifier || desc.isImportNamespaceSpecifier || desc.isImportSpecifier){
                    const jsModule = desc.parentStack.getResolveJSModule();
                    if(jsModule){
                        const value = desc.description();
                        let key = null;
                        if(value.isDeclaratorVariable || value.isDeclaratorFunction){
                            key = value.value();
                        }else{
                            const type = value.type();
                            if(Module.is(type) && type.isClass){
                                key = type.id;
                            }
                        }
                        if(key){
                            const value = AutoImporter.create(jsModule.id, key, '*');
                            value.origin = this;
                            this.namespace.imports.set(key, value);
                        }
                    }
                }
            }
        }
    }
    parser(){
        if(super.parser()===false)return false;
        this.expression.parser();
        const desc = this.description();
        if(desc){
            this.expression.setRefBeUsed(desc);
        }else{
            this.expression.error(1013,this.expression.value());
        }
    }
}

module.exports = ExportAssignmentDeclaration;