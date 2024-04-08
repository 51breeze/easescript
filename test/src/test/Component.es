package test{

    class Component<T>{

        private skinInstance:any;
        private _skinClass:class< Array<T> >;

        get skin(){
            const instance = this.skinInstance;
            if(instance)return instance;
            return this.skinInstance = new this.skinClass(10);
        }

        set skinClass(value:class< Array<T> > ){
            if( this._skinClass !== value ){
                this._skinClass = value;
                this.skinInstance = null;
            }
        }

        get skinClass(){
            return this._skinClass
        }
    }

    declare interface ComponentInterface{

    }
}

 <style>
    
        body{
            font-size:12px
        }
    
    </style>