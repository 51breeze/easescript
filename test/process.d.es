/**
 * The `assert` module provides a set of assertion functions for verifying
 * invariants.
 * @see [source](https://github.com/nodejs/node/blob/v16.9.0/lib/assert.js)
 */
 
declare module 'process' {

    namespace process{

        export function exit():void;
        export function exit(t:number):boolean;
    }

    export = process

}

declare module "stream" {

    class internal{
        pipe():any;
    }
    
    namespace internal {
        class Stream extends internal {
            constructor();
        }
        interface StreamOptions{
          
        }
    }

    export = internal;

}

declare module "node:stream" {
    export * from "stream";
}

declare module 'crypto'{

    import * as stream from "stream";

    interface HashOptions extends stream.StreamOptions {
        /**
         * For XOF hash functions such as `shake256`, the
         * outputLength option can be used to specify the desired output length in bytes.
         */
        outputLength?: number | undefined;
    }

    const fips: boolean;

    export *

}

package process{
    export *  from 'process';

}