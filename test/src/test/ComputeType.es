package test;

class ComputeType{

    start(){
        const obj = {value:'123'}
        const val = this.getValue(obj)

        const obj2 = {value:123}
        const val2 =this.getValue(obj2)

        const obj3 = {value:'123'}
        const val3 = this.getComputeValue(obj3)
        const val4 = this.geObjectValue({age:56}, 'age')
        const val5 = getComputeValueA(obj3)
    }

    getValue<T extends Ref<string>>(obj:T){
        return obj.value
    }

    getComputeValue<T extends Ref<string>>(obj:T):T['value'] | null{
        if(!obj)return null;
        return obj.value
    }

    geObjectValue<T, K extends string>(obj:T, key:K){
        return obj[key]
    }

    getComputeValueA<T extends Ref<string>>(obj:T){
        if(!obj)return null;
        return obj['value']
    }
}


declare interface Ref<B99>{
    value:B99
}