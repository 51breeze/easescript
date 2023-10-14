package test;
import net.Http as Request;

class Http {

    start(){

        const service = Request.create({
            timeout: 5000
        });
        
        service.interceptors.response.use(
            response => {
                const res = response.data
                if (res.code !== 200) {
                    return Promise.reject( new Error(res.message || 'Error') )
                } else {
                    return res
                }
            },
            error => {
                return Promise.reject(error)
            }
        )

        service.interceptors.request.use( (config)=>{
            config.headers['TOKEN'] ='loginInfo.token';
            return config;
        }, error=>{
            return Promise.reject(error);
        });


        return service;

    }


}