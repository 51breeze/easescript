package {

    declare interface IteratorYieldResult<TYield> {
        done?: false;
        value: TYield;
    }

    declare interface IteratorReturnResult<TReturn> {
        done: true;
        value: TReturn;
    }

    declare type IteratorResult<T, TReturn = any> = IteratorYieldResult<T> | IteratorReturnResult<TReturn>;

    declare interface SymbolConstructor {
        /**
        * Returns a new unique Symbol value.
        * @param  description Description of the new Symbol object.
        */
        (description?: string | number): symbol;

        /**
        * Returns a Symbol object from the global symbol registry matching the given key if found.
        * Otherwise, returns a new symbol with this key.
        * @param key key to search for.
        */
        for(key: string): symbol;

        /**
        * Returns a key from the global symbol registry matching the given Symbol if found.
        * Otherwise, returns a undefined.
        * @param sym Symbol to find the key for.
        */
        keyFor(sym: symbol): string | undefined;
    }

    declare type symbol = SymbolConstructor;

    declare var Symbol: SymbolConstructor;

    // Declare "static" methods in Error
    declare interface ErrorConstructor {
        /** Create .stack property on a target object */
        captureStackTrace(targetObject: object, constructorOpt?: Function): void;

        /**
        * Optional override for formatting stack traces
        *
        * @see https://v8.dev/docs/stack-trace-api#customizing-stack-traces
        */
        prepareStackTrace?: ((err: Error, stackTraces: NodeJS.CallSite[]) => any) | undefined;

        stackTraceLimit: number;
    }


    declare interface SymbolConstructor {
        /**
        * A method that returns the default async iterator for an object. Called by the semantics of
        * the for-await-of statement.
        */
        readonly asyncIterator: unique symbol;
    }

    declare interface PromiseLike<T> {
        /**
        * Attaches callbacks for the resolution and/or rejection of the Promise.
        * @param onfulfilled The callback to execute when the Promise is resolved.
        * @param onrejected The callback to execute when the Promise is rejected.
        * @returns A Promise for the completion of which ever callback is executed.
        */
        then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): PromiseLike<TResult1 | TResult2>;
    }


    declare interface AsyncIterator<T, TReturn = any> {
        // NOTE: 'next' is defined using a tuple to ensure we report the correct assignability errors in all places.
        next(...args:any[]): Promise<IteratorResult<T, TReturn>>;
        return?(value?: TReturn | PromiseLike<TReturn>): Promise<IteratorResult<T, TReturn>>;
        throw?(e?: any): Promise<IteratorResult<T, TReturn>>;
    }

    declare interface AsyncIterable<T> {
        [Symbol.asyncIterator](): AsyncIterator<T>;
    }


    declare interface AsyncIterableIterator<T> extends AsyncIterator<T> {
        [Symbol.asyncIterator](): AsyncIterableIterator<T>;
    }

    // For backwards compability
    declare interface NodeRequire extends NodeJS.Require {}
    declare interface RequireResolve extends NodeJS.RequireResolve {}
    declare interface NodeModule extends NodeJS.Module {}

    declare var process: NodeJS.Process;
    declare var __filename: string;
    declare var __dirname: string;
    declare var require: NodeRequire;
    declare var module: NodeModule;

    // Same as module.exports
    declare var exports: any;

    /**
    * Only available if `--expose-gc` is passed to the process.
    */
    declare var gc: undefined | (() => void);

    // #region borrowed
    // from https://github.com/microsoft/TypeScript/blob/38da7c600c83e7b31193a62495239a0fe478cb67/lib/lib.webworker.d.ts#L633 until moved to separate lib
    /** A controller object that allows you to abort one or more DOM requests as and when desired. */
    declare interface AbortController {
        /**
        * Returns the AbortSignal object associated with this object.
        */

        const signal: AbortSignal;
        /**
        * Invoking this method will set this object's AbortSignal's aborted flag and signal to any observers that the associated activity is to be aborted.
        */
        abort(reason?: any): void;
    }

    /** A signal object that allows you to communicate with a DOM request (such as a Fetch) and abort it if required via an AbortController object. */
    declare interface AbortSignal {
        /**
        * Returns true if this AbortSignal's AbortController has signaled to abort, and false otherwise.
        */
        const aborted: boolean;
        const reason: any;
    }

    declare var AbortController: {
        prototype: AbortController;
        new(): AbortController;
    };

    declare var AbortSignal: {
        prototype: AbortSignal;
        new(): AbortSignal;
        abort(reason?: any): AbortSignal;
        timeout(milliseconds: number): AbortSignal;
    };
    // #endregion borrowed

    // #region ArrayLike.at()
    declare interface RelativeIndexable<T> {
        /**
        * Takes an integer value and returns the item at that index,
        * allowing for positive and negative integers.
        * Negative integers count back from the last item in the array.
        */
        at(index: number): T | undefined;
    }
    interface String extends RelativeIndexable<string> {}
    interface Array<T> extends RelativeIndexable<T> {}
    interface ReadonlyArray<T> extends RelativeIndexable<T> {}
    interface Int8Array extends RelativeIndexable<number> {}
    interface Uint8Array extends RelativeIndexable<number> {}
    interface Uint8ClampedArray extends RelativeIndexable<number> {}
    interface Int16Array extends RelativeIndexable<number> {}
    interface Uint16Array extends RelativeIndexable<number> {}
    interface Int32Array extends RelativeIndexable<number> {}
    interface Uint32Array extends RelativeIndexable<number> {}
    interface Float32Array extends RelativeIndexable<number> {}
    interface Float64Array extends RelativeIndexable<number> {}
    interface BigInt64Array extends RelativeIndexable<number> {}
    interface BigUint64Array extends RelativeIndexable<number> {}
    // #endregion ArrayLike.at() end

    declare interface IterableIterator<T> extends Iterator {
        [Symbol.iterator](): IterableIterator<T>;
    }
    
    declare interface AsyncGenerator<T = any, TReturn = any> extends AsyncIterator<T, TReturn> {
        // NOTE: 'next' is defined using a tuple to ensure we report the correct assignability errors in all places.
        next(...args:any[]): Promise<IteratorResult<T, TReturn>>;
        return(value: TReturn | PromiseLike<TReturn>): Promise<IteratorResult<T, TReturn>>;
        throw(e: any): Promise<IteratorResult<T, TReturn>>;
        [Symbol.asyncIterator](): AsyncGenerator<T, TReturn>;
    }

    declare interface AsyncGeneratorFunction {
        /**
        * Creates a new AsyncGenerator object.
        * @param args A list of arguments the function accepts.
        */
        new (...args: any[]): AsyncGenerator;
        /**
        * Creates a new AsyncGenerator object.
        * @param args A list of arguments the function accepts.
        */
        (...args: any[]): AsyncGenerator;
        /**
        * The length of the arguments.
        */
        readonly length: number;
        /**
        * Returns the name of the function.
        */
        readonly name: string;
        /**
        * A reference to the prototype.
        */
        readonly prototype: AsyncGenerator;
    }

    declare interface AsyncGeneratorFunctionConstructor {
        /**
        * Creates a new AsyncGenerator function.
        * @param args A list of arguments the function accepts.
        */
        new (...args: string[]): AsyncGeneratorFunction;
        /**
        * Creates a new AsyncGenerator function.
        * @param args A list of arguments the function accepts.
        */
        (...args: string[]): AsyncGeneratorFunction;
        /**
        * The length of the arguments.
        */
        readonly length: number;
        /**
        * Returns the name of the function.
        */
        readonly name: string;
        /**
        * A reference to the prototype.
        */
        readonly prototype: AsyncGeneratorFunction;
    }

    
    interface ReadonlySet<T> {
        /** Iterates over values in the set. */
        [Symbol.iterator](): IterableIterator<T>;

        /**
        * Returns an iterable of [v,v] pairs for every value `v` in the set.
        */
        entries(): IterableIterator<[T, T]>;

        /**
        * Despite its name, returns an iterable of the values in the set.
        */
        keys(): IterableIterator<T>;

        /**
        * Returns an iterable of values in the set.
        */
        values(): IterableIterator<T>;
    }


}

declare namespace NodeJS {

    declare interface CallSite {
        /**
         * Value of "this"
         */
        getThis(): any;

        /**
         * Type of "this" as a string.
         * This is the name of the function stored in the constructor field of
         * "this", if available.  Otherwise the object's [[Class]] internal
         * property.
         */
        getTypeName(): string | null;

        /**
         * Current function
         */
        getFunction(): Function | undefined;

        /**
         * Name of the current function, typically its name property.
         * If a name property is not available an attempt will be made to try
         * to infer a name from the function's context.
         */
        getFunctionName(): string | null;

        /**
         * Name of the property [of "this" or one of its prototypes] that holds
         * the current function
         */
        getMethodName(): string | null;

        /**
         * Name of the script [if this function was defined in a script]
         */
        getFileName(): string | undefined;

        /**
         * Current line number [if this function was defined in a script]
         */
        getLineNumber(): number | null;

        /**
         * Current column number [if this function was defined in a script]
         */
        getColumnNumber(): number | null;

        /**
         * A call site object representing the location where eval was called
         * [if this function was created using a call to eval]
         */
        getEvalOrigin(): string | undefined;

        /**
         * Is this a toplevel invocation, that is, is "this" the global object?
         */
        isToplevel(): boolean;

        /**
         * Does this call take place in code defined by a call to eval?
         */
        isEval(): boolean;

        /**
         * Is this call in native V8 code?
         */
        isNative(): boolean;

        /**
         * Is this a constructor call?
         */
        isConstructor(): boolean;
    }

    declare interface ErrnoException extends Error {
        errno?: number | undefined;
        code?: string | undefined;
        path?: string | undefined;
        syscall?: string | undefined;
    }

    declare interface ReadableStream extends EventEmitter {
        readable: boolean;
        read(size?: number): string | Buffer;
        setEncoding(encoding: BufferEncoding): this;
        pause(): this;
        resume(): this;
        isPaused(): boolean;
        pipe<T extends WritableStream>(destination: T, options?: { end?: boolean | undefined }): T;
        unpipe(destination?: WritableStream): this;
        unshift(chunk: string | Uint8Array, encoding?: BufferEncoding): void;
        wrap(oldStream: ReadableStream): this;
        [Symbol.asyncIterator](): AsyncIterableIterator<string | Buffer>;
    }

    declare interface WritableStream extends EventEmitter {
        writable: boolean;
        write(buffer: Uint8Array | string, cb?: (err?: Error | null) => void): boolean;
        write(str: string, encoding?: BufferEncoding, cb?: (err?: Error | null) => void): boolean;
        end(cb?: () => void): void;
        end(data: string | Uint8Array, cb?: () => void): void;
        end(str: string, encoding?: BufferEncoding, cb?: () => void): void;
    }

    declare interface ReadWriteStream extends ReadableStream implements WritableStream {}

    declare interface RefCounted {
        ref(): this;
        unref(): this;
    }

    declare type TypedArray =
        | Uint8Array
        | Uint8ClampedArray
        | Uint16Array
        | Uint32Array
        | Int8Array
        | Int16Array
        | Int32Array
        | BigUint64Array
        | BigInt64Array
        | Float32Array
        | Float64Array;
    declare type ArrayBufferView = TypedArray | DataView;

    declare interface Require {
        (id: string): any;
        resolve: RequireResolve;
        cache: Dict<NodeModule>;
        /**
         * @deprecated
         */
        extensions: RequireExtensions;
        main: Module | undefined;
    }

    declare interface RequireResolve {
        (id: string, options?: { paths?: string[] | undefined }): string;
        paths(request: string): string[] | null;
    }

    declare interface RequireExtensions extends Dict<(m: Module, filename: string) => any> {
        ".js": (m: Module, filename: string) => any;
        ".json": (m: Module, filename: string) => any;
        ".node": (m: Module, filename: string) => any;
    }
    declare interface Module {
        /**
         * `true` if the module is running during the Node.js preload
         */
        isPreloading: boolean;
        exports: any;
        require: Require;
        id: string;
        filename: string;
        loaded: boolean;
        /** @deprecated since v14.6.0 Please use `require.main` and `module.children` instead. */
        parent: Module | null | undefined;
        children: Module[];
        /**
         * @since v11.14.0
         *
         * The directory name of the module. This is usually the same as the path.dirname() of the module.id.
         */
        path: string;
        paths: string[];
    }

    declare interface Dict<T> {
        [key: string]: T | undefined;
    }

    declare interface ReadOnlyDict<T> {
        const [key: string]: T | undefined;
    }
}
