package;

import Gen123;

class Gen<T> implements com.GenInterfac<T,number>{


    private _host:T
    constructor(host:T){
        this._host = host;
        const target = this.getName<Gen123>( this.getTarget() );
        target.getAddress('sss');
    }

    getTarget():any{
        return new Gen123();
    }

    getType(name:T){
        return name;
    }

    getName<B>(name:B){
        return name;
    }

    getAddress(name){
        return name;
    }

    get host():T{
        return this._host;
    }

}