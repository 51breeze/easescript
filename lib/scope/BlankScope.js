const BlockScope = require("./BlockScope");
module.exports = class BlankScope extends BlockScope {
    constructor( parentScope ){
        super(parentScope);
    }
    type( name ){
        return name === "blank";
    }
} 