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
        if(parentStack.isModuleDeclaration){
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
        const decl = this.declaration;
        if(decl.isClassDeclaration || 
            decl.isDeclaratorDeclaration || 
            decl.isNamespaceDeclaration || 
            decl.isEnumDeclaration && !decl.isExpressionDeclare || 
            decl.isInterfaceDeclaration || 
            decl.isStructTableDeclaration
        ){
            return decl.module;
        }
        if(this.parentStack.isModuleDeclaration) {
            if( 
                decl.isTypeStatement ||
                decl.isDeclaratorTypeAlias
            ){
                return decl.type();
            }
        }
        return decl.description();
    }
    descriptor(){
        const desc = this.description();
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