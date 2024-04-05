declare Promise<T=any>{

    /**
    * Creates a Promise that is resolved with an array of results when all of the provided Promises
    * resolve, or rejected when any Promise is rejected.
    * @param values An iterable of Promises.
    * @returns A new Promise.
    */
    static all<T=any>(values: Iterator<any>): Promise<T[]>;

    /**
    * Creates a Promise that is resolved or rejected when any of the provided Promises are resolved
    * or rejected.
    * @param values An iterable of Promises.
    * @returns A new Promise.
    */
    static race<T=any>(values: Iterator<any>): Promise<T>;

        /**
    * Creates a Promise that is resolved with an array of results when all
    * of the provided Promises resolve or reject.
    * @param values An array of Promises.
    * @returns A new Promise.
    */
    static allSettled<T=any>(values:Iterator<any>): Promise<T[]>;

    /**
    * Creates a new rejected promise for the provided reason.
    * @param reason The reason the promise was rejected.
    * @returns A new rejected Promise.
    */
    static reject<T=any>(reason?:T): Promise<T>;

    /**
    * Creates a new resolved promise for the provided value.
    * @param value A promise.
    * @returns A promise whose internal state matches the provided promise.
    */
    static resolve<T=any>(value?:T): Promise<T>;

    /**
    * Creates a new Promise.
    * @param executor A callback used to initialize the promise. This callback is passed two arguments:
    * a resolve callback used to resolve the promise with a value or the result of another promise,
    * and a reject callback used to reject the promise with a provided reason or error.
    */
    constructor( executor:(resolve:(value:T) => void, reject:(reason?:any) =>void) => void);

    /**
    * Attaches callbacks for the resolution and/or rejection of the Promise.
    * @param onfulfilled The callback to execute when the Promise is resolved.
    * @param onrejected The callback to execute when the Promise is rejected.
    * @returns A Promise for the completion of which ever callback is executed.
    */
    then(onfulfilled?:(value:T)=>void , onrejected?:(reason: any)=>void): Promise<T>;

    /**
    * Attaches a callback for only the rejection of the Promise.
    * @param onrejected The callback to execute when the Promise is rejected.
    * @returns A Promise for the completion of the callback.
    */
    catch(onrejected?: (reason: any) => void): Promise<T>;

    finally<T=any>(onFinally:()=>T): Promise<T>;

}