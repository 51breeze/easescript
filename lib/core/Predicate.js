class Predicate{

    static create(type, desc=null, origin=null, cacheId=null){
        return new Predicate(origin, type, desc, cacheId)
    }

    static attribute(key, value, origin=null){
        const pred = new Predicate(origin);
        pred.setAttribute(key, value);
        return pred;
    }

    #origin = null;
    #type = null;
    #desc = null;
    #attributes = null;
    #scope = null;
    #cacheId = null;

    constructor(origin=null, type=null, desc=null, cacheId=null){
        this.#origin = origin;
        this.#type = type;
        this.#desc = desc;
        this.#cacheId = cacheId;
    }

    get cacheId(){
        return this.#cacheId;
    }

    get scope(){
        return this.#scope;
    }

    set scope(value){
        this.#scope = value;
    }
    
    get type(){
        return this.#type;
    }

    set type(value){
        this.#type = value;
    }

    get origin(){
        return this.#origin;
    }

    get desc(){
        return this.#desc;
    }

    set desc(value){
        this.#desc = value;
    }

    get attributes(){
        return this.#attributes || (this.#attributes=Object.create(null));
    }

    getAttribute(key, defaultValue=null){
        return this.attributes[key] || defaultValue;
    }

    setAttribute(key, value){
        this.attributes[key]=value;
    }
}
module.exports = Predicate;