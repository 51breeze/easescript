const Stack = require("../core/Stack");
class EmptyStatement extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isEmptyStatement= true;
    }
}
module.exports = EmptyStatement;