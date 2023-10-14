const Scope = require("../core/Scope");
module.exports = class BlockScope extends Scope {
    constructor( parentScope ) {
        super(parentScope);
    }
    type( name ){
        return name === "block";
    }
} 