const Scope = require("../core/Scope");
module.exports = class InterfaceScope extends Scope {
    constructor( parentScope ){
        super(parentScope);
        this.isInterfaceScope = true;
    }
    type( name ){
        return name === "interface";
    }
} 