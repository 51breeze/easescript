const Scope = require("../core/Scope");
module.exports = class BlankScope extends Scope {
    constructor( parentScope ){
        super(parentScope);
    }
    type( name ){
        return name === "blank";
    }
} 