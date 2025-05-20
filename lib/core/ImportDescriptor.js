class ImportDescriptor{
    static is(value){
        return value && value instanceof ImportDescriptor;
    }

    static create(source, local, imported, extract=false, isDefault=false){
        return new ImportDescriptor(source, local, imported, extract, isDefault)
    }

    #source = null;
    #local = null;
    #imported = null;
    #extract=false;
    #isDefault = false;

    constructor(source, local, imported, extract=false, isDefault=false){
        this.#source = source;
        this.#local = local;
        this.#imported = imported;
        this.#extract = !!extract;
        this.#isDefault = isDefault;
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

module.exports = ImportDescriptor