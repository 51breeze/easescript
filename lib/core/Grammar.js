const events = require('events');
class Grammar extends events.EventEmitter {
    constructor(name){ 
        super();
        this.syntaxName = name;
    }
    isRuntime( name ){
        switch( name.toLowerCase() ){
            case "client" :
                return this.syntaxName ==="javascript";
            case  "server" :
                return this.syntaxName !=="javascript";    
        }
        return false;
    }
    isSyntax( name ){
        return name.toLowerCase() === this.syntaxName;
    }
    dispatcher(event, ...args){
        return super.emit(event, ...args);
    }
}


module.exports = Grammar;
