class AutoImporter{
    static is(value){
        return value && value instanceof AutoImporter;
    }

    static create(source, local, imported, extract=false, isDefault=false, origin=null){
        return new AutoImporter(source, local, imported, extract, isDefault, origin)
    }

    #source = null;
    #local = null;
    #imported = null;
    #extract=false;
    #isDefault = false;
    #compilation = null;
    #origin = null;
    #description = null;
    #owner = null;
    #origins = new Set();

    constructor(source, local, imported, extract=false, isDefault=false, origin=null){
        this.#source = source;
        this.#local = local;
        this.#imported = imported;
        this.#extract = !!extract;
        this.#isDefault = isDefault;
        this.#origin = origin;
        if(origin){
            this.#compilation = origin.compilation;
        }
    }

    get description(){
        return this.#description;
    }

    set description(value){
        if(value){
            this.#description = value;
        }
    }

    get owner(){
        return this.#owner;
    }

    set owner(value){
        if(value){
            this.#owner = value;
        }
    }

    get origin(){
        return this.#origin;
    }

    set origin(value){
        this.#origin = value;
        if(value){
            this.#compilation = value.compilation;
            this.#origins.add(value);
        }
    }

    get origins(){
        return this.#origins;
    }

    get compilation(){
        return this.#compilation;
    }

    get source(){
        return this.#source;
    }

    get local(){
        return this.#local;
    }

    get imported(){
        return this.#imported;
    }

    get extract(){
        return this.#extract;
    }

    get namespace(){
        return this.#imported === "*";
    }

    get isDefault(){
        return this.#isDefault;
    }
}

module.exports = AutoImporter