const Scope = require("../core/Scope");
module.exports = class DeclaratorScope extends Scope {
    constructor( parentScope ){
        super(parentScope);
    }
    type( name ){
        return name === "declarator";
    }
} 