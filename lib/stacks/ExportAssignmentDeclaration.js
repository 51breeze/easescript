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
    description(){
        return this.expression.description()
    }
    descriptor(){
        return this.expression.descriptor()
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
    }
    parser(){
        if(super.parser()===false)return false;
        this.expression.parser();
        this.expression.setRefBeUsed();
    }
}

module.exports = ExportAssignmentDeclaration;