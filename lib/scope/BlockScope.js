const Scope = require("../core/Scope");
module.exports = class BlockScope extends Scope {
    constructor( parentScope ) {
        super(parentScope);
        this.isBlockScope = true;
        this._predicates=null
        this._validates=null
    }
    type( name ){
        return name === "block";
    }

    get predicates(){
        return this._predicates || (this._predicates = new Map())
    }

    get validates(){
        return this._validates || (this._validates = new Map())
    }

    setPredicateType(descriptor, type){
        this.predicates.set(descriptor, type);
    }

    getPredicateType(descriptor, onlyFlag=false){
        let type = this.predicates.get( descriptor );
        if( !type && !onlyFlag){
            let parentScope = this.parent;
            while( parentScope && parentScope instanceof Scope ){
                if(parentScope.isBlockScope){
                    type = parentScope.predicates.get( descriptor )
                    if(type)return type;
                    parentScope = parentScope.parent;
                }else if(parentScope.isFunctionScope){
                    parentScope = parentScope.parent;
                }else{
                    break;
                }
            }
        }
        return type || null;
    }

    getValidateState(descriptor, onlyFlag=false){
        let info = this.validates.get( descriptor );
        if( !info && !onlyFlag){
            let parentScope = this.parent;
            while( parentScope && parentScope instanceof Scope ){
                if(parentScope.isBlockScope){
                    info = parentScope.validates.get( descriptor )
                    if(info)return info;
                    parentScope = parentScope.parent;
                }else if(parentScope.isFunctionScope){
                    parentScope = parentScope.parent;
                }else{
                    break;
                }
            }
        }
        return info || null;
    }

    setValidateState(descriptor, type, value, expr){
        this.validates.set(descriptor, {type, value, expr})
    }
}