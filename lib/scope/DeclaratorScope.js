const Scope = require("../core/Scope");
module.exports = class DeclaratorScope extends Scope {
    constructor( parentScope ){
        super(parentScope);
        this.isDeclaratorScope = true;
    }
    type( name ){
        return name === "declarator";
    }
} 