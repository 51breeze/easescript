const Stack = require("../core/Stack");
class ModifierDeclaration extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack)
    {
        super(compilation,node,scope,parentNode,parentStack);
        this.isModifierDeclaration= true;
    }
}
module.exports = ModifierDeclaration;