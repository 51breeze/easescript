/**
 * The `assert` module provides a set of assertion functions for verifying
 * invariants.
 * @see [source](https://github.com/nodejs/node/blob/v16.9.0/lib/assert.js)
 */
 
declare module 'process' {

    namespace process{

        function exit():void;
        function exit(t:number):boolean;
    }

}