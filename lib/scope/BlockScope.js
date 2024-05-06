const Scope = require("../core/Scope");
module.exports = class BlockScope extends Scope {
    constructor( parentScope ) {
        super(parentScope);
        this.isBlockScope = true;
        this._predicates=null
    }
    type( name ){
        return name === "block";
    }

    get predicates(){
        return this._predicates || (this._predicates = new Map())
    }

    setPredicateType(descriptor, type){
        this.predicates.set(descriptor, type);
    }

    getPredicateType(descriptor, onlyFlag=false){
        let type = this.predicates.get( descriptor );
        if( !type && !onlyFlag){
            let parentScope = this.parent;
            while( parentScope && parentScope instanceof Scope ){
                if(!parentScope.isBlockScope)break;
                type = parentScope.predicates.get( descriptor )
                if(type)return type
                parentScope = parentScope.parent;
            }
        }
        return type || null;
    }
} 