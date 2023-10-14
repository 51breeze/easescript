package bug;
import net.Http;
import net.HttpResponse;
import net.HttpInterceptorManager;


static class HttpRequest{

    private _instance:Http = null;
    private get instance(){
        if( _instance )return _instance;
        let baseURL = `/web/chat`;
        const http = Http.create({
            baseURL:baseURL
        });
        _instance = http;

        type ResType = HttpResponse<{status:int,data:any}>;

        http.interceptors.request.use( (config)=>{
            config.headers['TOKEN'] ='loginInfo.token';
            
            return config;
        }, error=>{
            return Promise.reject(error);
        });

        const response = http.interceptors.response as HttpInterceptorManager< ResType >;
        response.use<any>( (res)=>{
            return res.data;
        }, error=>{
            return Promise.reject(error);
        });

        return http;
    }

    start(){

       instance.post('url',{});

    }

    post(url, data?){
        return instance.post(url,data);
    }

    get(url, params?){
        return instance.get(url, {params});
    } 

}