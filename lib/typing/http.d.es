package net{
    
    declare interface HttpBasicCredentials {
        username: string;
        password: string;
    }

    declare interface HttpProxyConfig {
        host: string;
        port: number;
        auth?:HttpBasicCredentials
    }
    declare interface HttpResponse<T = any>  {
        data: T;
        status: number;
        statusText: string;
        headers: {[key:string]:any};
        config: HttpConfig;
        request?: any;
    }

    declare interface HttpInterceptorManager<V> {
        use<T=V>(onFulfilled?: (value: V)=>T | Promise<T>, onRejected?: (error:any) =>any): number;
        eject(id: number): void;
    }

    declare class HttpAdapter {
        constructor(config: HttpConfig): Promise< HttpResponse<any> >;
    }

    declare class HttpTransformer {
        @Callable
        constructor(data: any, headers?: any): any;
    }

    import {CancelToken as HttpCancelToken} from 'axios';
    declare class HttpCancelToken {
        constructor( executor:(cancel:(message)=>void)=>void );
        promise: Promise<HttpCancel>;
        reason?: HttpCancel;
        throwIfRequested(): void;
        /**
        * Subscribe to the cancel signal
        */
        subscribe(listener:()=>void):void
        /**
        * Unsubscribe from the cancel signal
        */
        unsubscribe(listener:()=>void):void

        static source():HttpCancelTokenSource
    }

    import {Cancel as HttpCancel} from 'axios';
    declare class HttpCancel {
        message: string;
        constructor(message: string);
    }

    declare interface HttpCancelTokenSource {
        token: HttpCancelToken;
        cancel: (message?: string)=>void;
    }

    declare interface HttpConfig {
        url?: string;
        method?: string;
        baseURL?: string;
        transformRequest?: HttpTransformer | HttpTransformer[];
        transformResponse?: HttpTransformer | HttpTransformer[];
        headers?: any;
        params?: any;
        paramsSerializer?: (params: any) => string;
        data?: any;
        timeout?: number;
        withCredentials?: boolean;
        adapter?: HttpAdapter;
        auth?: HttpBasicCredentials;
        responseType?: string;
        xsrfCookieName?: string;
        xsrfHeaderName?: string;
        onUploadProgress?: (progressEvent: any) => void;
        onDownloadProgress?: (progressEvent: any) => void;
        maxContentLength?: number;
        validateStatus?: (status: number) => boolean;
        maxRedirects?: number;
        httpAgent?: any;
        httpsAgent?: any;
        proxy?: HttpProxyConfig | false;
        cancelToken?: HttpCancelToken;
    }

    import Http from 'axios';
    declare class Http{

        static create(config?:HttpConfig):Http;
        static isCancel(value: any): boolean;
        static all<T=any>(values: (T | Promise<T>)[]): Promise<T[]>;
        static spread<T=any, R=any>(callback: (...args: T[]) => R): (array: T[]) => R;

        constructor(config: HttpConfig);

        defaults: HttpConfig;
        interceptors: {
            request: HttpInterceptorManager<HttpConfig>,
            response: HttpInterceptorManager<HttpResponse>
        };

        request<T=any, R=HttpResponse<T>>(config: HttpConfig): Promise<R|T>;
        get<T=any, R=HttpResponse<T>>(url: string, config?: HttpConfig): Promise<R|T>;
        delete<T=any, R=HttpResponse<T>>(url: string, config?: HttpConfig): Promise<R|T>;
        head<T=any, R=HttpResponse<T>>(url: string, config?: HttpConfig): Promise<R|T>;
        post<T=any, R=HttpResponse<T>>(url: string, data?: any, config?: HttpConfig):Promise<R|T>;
        put<T=any, R=HttpResponse<T>>(url: string, data?: any, config?: HttpConfig): Promise<R|T>;
        patch<T=any, R=HttpResponse<T>>(url: string, data?: any, config?: HttpConfig): Promise<R|T>;

    }

}
