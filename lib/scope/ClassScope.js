const Scope = require("../core/Scope");
module.exports = class ClassScope extends Scope {
    constructor( parentScope, isStatic ){
        super(parentScope);
        this.isStatic = isStatic;
        this.level = parentScope ? parentScope.level+1 : 1;
        this.isClassScope = true;
    }
    type( name ){
        return name === "class";
    }
} 