const Scope = require("../core/Scope");
module.exports = class NamespaceScope extends Scope {
    constructor(parentScope){
        super(parentScope);
        this.isNamespaceScope = true;
    }
    type( name ){
        return name === "ns";
    }
}