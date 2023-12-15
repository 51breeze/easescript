class Plugin{
    
    constructor(compiler){
        this._compiler = compiler;
    }

    get compiler(){
        return this._compiler
    }

    get name(){
        return 'es-javascript'
    }

    get platform(){
        return 'client'
    }

    buildStart(){

    }
}