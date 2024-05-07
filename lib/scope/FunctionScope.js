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
        this.isFunctionScope = true;
    }

    type( name ){
        return name === "function";
    }

    getPredicateType(descriptor){
        let parentScope = this.parent;
        while( parentScope && parentScope instanceof Scope){
            if(parentScope.isBlockScope){
                let type = parentScope.predicates.get(descriptor)
                if(type)return type;
                parentScope = parentScope.parent;
            }else if(parentScope.isFunctionScope){
                parentScope = parentScope.parent;
            }else{
                break;
            }
        }
        return null;
    }

    getValidateState(descriptor){
        let parentScope = this.parent;
        while( parentScope && parentScope instanceof Scope ){
            if(parentScope.isBlockScope){
                let info = parentScope.validates.get( descriptor )
                if(info)return info;
                parentScope = parentScope.parent;
            }else if(parentScope.isFunctionScope){
                parentScope = parentScope.parent;
            }else{
                break;
            }
        }
        return null;
    }
} 