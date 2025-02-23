package test;

class GenericConstraint{

    start(){

        GenericConstraint.newInstance( new GenericConstraint() );
        GenericConstraint.newInstance(Array as Array<any>);
        GenericConstraint.newInstance( GenericConstraint );
        const classObject:class<GenericConstraint> = GenericConstraint;
        GenericConstraint.newInstance( classObject ).getInfo()
    }

    getInfo(){
        return {};
    }


    static newInstance<T extends class<any>>(classObject:T){
        return new classObject();
    }

}