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
        if(decl.isClassDeclaration || decl.isDeclaratorDeclaration || decl.isEnumDeclaration && !decl.isExpressionDeclare){
            return decl.module || Namespace.globals.get('any');
        }
        return this.declaration.description() || Namespace.globals.get('any');
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