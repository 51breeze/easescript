/**
 * The `assert` module provides a set of assertion functions for verifying
 * invariants.
 * @see [source](https://github.com/nodejs/node/blob/v16.9.0/lib/assert.js)
 */
 
declare module 'assert' {

    /**
    * An alias of {@link ok}.
    * @since v0.5.9
    * @param value The input that is checked for being truthy.
    */
    declare function assert<T=any>(value:T, message?: string | Error):T;

    export default assert;

    import {exit} from 'process';

    export {exit}

    namespace assert{

            /**
            * Indicates the failure of an assertion. All errors thrown by the `assert` module
            * will be instances of the `AssertionError` class.
            */
         class AssertionError extends Error {
            actual: any;
            expected: any;
            operator: string;
            generatedMessage: boolean;
            code: "ERR_ASSERTION";
            constructor(options?: {
                /** If provided, the error message is set to this value. */
                message?: string,
                /** The `actual` property on the error instance. */
                actual?: any,
                /** The `expected` property on the error instance. */
                expected?:any,
                /** The `operator` property on the error instance. */
                operator?: string,
                /** If provided, the generated stack trace omits frames before this function. */
                // tslint:disable-next-line:ban-types
                stackStartFn?: Function
            });
        }


         /**
        * Expects the `string` input to match the regular expression.
        *
        * ```js
        * import assert from 'assert/strict';
        *
        * assert.match('I will fail', /pass/);
        * // AssertionError [ERR_ASSERTION]: The input did not match the regular ...
        *
        * assert.match(123, /pass/);
        * // AssertionError [ERR_ASSERTION]: The "string" argument must be of type string.
        *
        * assert.match('I will pass', /pass/);
        * // OK
        * ```
        *
        * If the values do not match, or if the `string` argument is of another type than`string`, an `AssertionError` is thrown with a `message` property set equal
        * to the value of the `message` parameter. If the `message` parameter is
        * undefined, a default error message is assigned. If the `message` parameter is an
        * instance of an `Error` then it will be thrown instead of the `AssertionError`.
        * @since v13.6.0, v12.16.0
        */
        function match(value: string, regExp: RegExp, message?: string | Error): void;
        /**
            * Expects the `string` input not to match the regular expression.
            *
            * ```js
            * import assert from 'assert/strict';
            *
            * assert.doesNotMatch('I will fail', /fail/);
            * // AssertionError [ERR_ASSERTION]: The input was expected to not match the ...
            *
            * assert.doesNotMatch(123, /pass/);
            * // AssertionError [ERR_ASSERTION]: The "string" argument must be of type string.
            *
            * assert.doesNotMatch('I will pass', /different/);
            * // OK
            * ```
            *
            * If the values do match, or if the `string` argument is of another type than`string`, an `AssertionError` is thrown with a `message` property set equal
            * to the value of the `message` parameter. If the `message` parameter is
            * undefined, a default error message is assigned. If the `message` parameter is an
            * instance of an `Error` then it will be thrown instead of the `AssertionError`.
            * @since v13.6.0, v12.16.0
            */
        function doesNotMatch(value: string, regExp: RegExp, message?: string | Error): void;
        const strict:typeof assert & {
                doesNotMatch:typeof doesNotMatch,
            };



    }


    export * from './src/config.es'
    export * as Config from './src/config.es'
   
    
}