const ModuleDeclaration = require("./ModuleDeclaration");
class NamespaceDeclaration extends ModuleDeclaration{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isNamespaceDeclaration= true;
    }
}

module.exports = NamespaceDeclaration;