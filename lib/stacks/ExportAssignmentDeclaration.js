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
    definition(){
        const desc = this.description();
        if(desc && !desc.isLiteral){
            return desc.definition();
        }
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