const FunctionScope = require("./FunctionScope");
module.exports = class MethodScope extends FunctionScope {
    constructor( parentScope ){
        super(parentScope);
    }
    type( name, flag )
    {
        return name === "method" || (flag && name === "function");
    }
} 