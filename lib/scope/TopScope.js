const Scope = require("../core/Scope");
module.exports = class TopScope extends Scope {
    constructor( parentScope ){
        super(parentScope);
        this.isTopScope = true;
    }
    type( name ){
        return name === "top";
    }
} 