const events = require('events');
const keySymbol = Symbol("keySymbol");
events.EventEmitter.defaultMaxListeners = 100000
class EventDispatcher{
    constructor(){
        this[keySymbol] = new events.EventEmitter();  
    }
    addListener(event, listener){
        return this[keySymbol].addListener(event, listener);
    }
    on(event, listener){
        return this[keySymbol].on(event, listener);
    }
    once(event, listener){
        return this[keySymbol].once(event, listener);
    }
    removeListener(event, listener){
        return this[keySymbol].removeListener(event, listener);
    }
    off(event, listener){
        return this[keySymbol].off(event, listener);
    }
    removeAllListeners(event, listener){
        return this[keySymbol].removeAllListeners(event, listener);
    }
    dispatcher(event, ...args){
        return this[keySymbol].emit(event, ...args);
    }
}
module.exports = EventDispatcher;