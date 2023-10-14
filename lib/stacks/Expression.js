const Stack = require("../core/Stack");
class Expression extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isExpression= true;
    }
    reference(){
        const description = this.description();
        if( description !== this && description instanceof Stack ){
            return description.reference();
        }
        return description;
    }
    referenceItems(){
        const description = this.description();
        if( description !== this && description instanceof Stack ){
            return description.referenceItems();
        }
        return [description];
    }
}
module.exports = Expression;