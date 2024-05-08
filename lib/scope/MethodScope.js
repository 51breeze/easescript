const FunctionScope = require("./FunctionScope");
module.exports = class MethodScope extends FunctionScope {
    constructor( parentScope ){
        super(parentScope);
        this.isMethodScope = true;
    }
    type(name){
        return name === "method" || name === "function";
    }
} 