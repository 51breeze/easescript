const JSModule = require("../core/JSModule");
const Stack = require("../core/Stack");
class ExportAssignmentDeclaration extends Stack {
    constructor(compilation,node,scope,parentNode,parentStack){ 
        super(compilation,node,scope,parentNode,parentStack);
        this.isExportAssignmentDeclaration = true;
        this.expression = this.createTokenStack(compilation, node.expression, scope, node, this);
        if( parentStack && !(parentStack.isProgram || parentStack.isPackageDeclaration || parentStack.isModuleDeclaration) ){
            this.error(1159);
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
            let items = null;
            if(!this.compilation.hasDeclareJSModule){
                items = this.namespace.descriptors.get(this.expression.value());
            }else if(JSModule.is(this.module)){
                items = this.module.descriptors.get(this.expression.value());
            }
            if(items && items.length > 1){
                return items.map(desc=>desc.definition(ctx)).filter(Boolean)
            }
        }
        const desc = this.description();
        if(desc && !desc.isLiteral){
            return desc.definition();
        }
        return null;
    }
    description(){
        return this.expression.description()
    }
    descriptor(){
        return this.expression.descriptor()
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
    }
    parser(){
        if(super.parser()===false)return false;
        this.expression.parser();
        this.expression.setRefBeUsed();
    }
}

module.exports = ExportAssignmentDeclaration;