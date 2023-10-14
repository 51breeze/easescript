const Scope = require("../core/Scope");
module.exports = class FunctionScope extends Scope {
    constructor( parentScope ){
        super(parentScope);
        this.arguments   = [];
        this.returnType  = null;
        this.returnItems = [];
        this.key         = null;
        this.isArrow     = false;
        this.isExpression = false;
    }

    type( name ){
        return name === "function";
    }
} 