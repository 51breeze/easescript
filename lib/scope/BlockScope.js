const Scope = require("../core/Scope");
module.exports = class BlockScope extends Scope {
    constructor( parentScope ) {
        super(parentScope);
        this.isBlockScope = true;
    }
    type( name ){
        return name === "block";
    }
}