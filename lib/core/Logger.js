const path = require('path');
const fs = require('fs');
let memoryUsed = process.memoryUsage().heapUsed;
let activeLogger = null;
let defaultUsage = {current:0, total:0};
let defaultOptions = {
    enable:true,
    outFile:true,
    outDir:'.es-client-log',
    outServiceDir:'.es-service-log',
    threshold:60,
    service:false,
    time:false,
    limitSize:1024 * 1024 * 2
};
class Logger{

    static print(info, group=''){
        if(activeLogger){
            activeLogger.print(info, group)
        }
    }

    static mark(key){
        if(activeLogger){
            activeLogger.mark(key)
        }
    }

    static getMemoryUsage(key){
        if(activeLogger){
            return activeLogger.getMemoryUsage(key)
        }
        return defaultUsage;
    }

    #compiler = null;
    #active = false;
    #memoryRecords = null;
    #outDir = false;
    #limitSize = -1;
    #threshold = 60;
    #lastFile = null;
    #lastTime = null;
    #formatDate = false;
    constructor(compiler){
        this.#compiler = compiler;
        this.init(compiler);
    }

    init(compiler){
        let options = compiler.options.logger;
        if(typeof options ==='object'){
            if(options){
                this.#active = options.enable;
            }else{
                options = defaultOptions;
            }
        }else{
            this.#active = !!options;
            options = defaultOptions;
        }

        if(compiler.options.service && !options.service){
            this.#active = false;
        }

        if(this.#active){
            if(options.outFile){
                let dir = compiler.options.service ? options.outServiceDir : options.outDir;
                if(!dir){
                    if(compiler.options.service){
                        dir =defaultOptions.outServiceDir
                    }else{
                        dir =defaultOptions.outDir
                    }
                }

                let cwd = compiler.options.cwd || process.cwd();
                if(options.limitSize>0){
                    this.#limitSize = options.limitSize;
                }
                if(options.threshold>=-1){
                    this.#threshold = options.threshold;
                }
                this.#formatDate = !!options.formatDate;
                if(!dir)dir = cwd;
                if(!path.isAbsolute(dir)){
                    dir = path.resolve(cwd, dir)
                    if(!fs.existsSync(dir)){
                        fs.mkdirSync(dir)
                    }
                }
                if(!fs.statSync(dir).isDirectory()){
                    throw new Error('Logger dir is not exists.')
                }else{
                    this.#outDir = this.#compiler.normalizePath(dir)
                }
            }
            this.#memoryRecords = new Map();
            activeLogger = this;
        }
    }

    getDate(flag=false){
        let time = parseFloat(Date.now() / 1000);
        let key = flag ? time+'-' : time;
        let same = this[key];
        if(same)return same;
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        if(flag){
            const hours = String(now.getHours()).padStart(2,'0')
            const min = String(now.getMinutes()).padStart(2,'0');
            const sec = String(now.getSeconds()).padStart(2,'0');
            return this[key] = `${year}-${month}-${day} ${hours}:${min}:${sec}`;
        }
        return this[key] = `${year}-${month}-${day}`;
    }

    getOutFile(fileName){
        return path.join(this.#outDir || process.cwd(), fileName)
    }

    getFile(){
        const outDir = this.#outDir;
        if(outDir){
            let last = this.#lastFile;
            let sec = parseFloat(Date.now() / 1000);
            if(last){
                let threshold = this.#threshold;
                let lastTime = this.#lastTime;
                if(threshold > 0 && threshold > (sec - lastTime)){
                    return last;
                }
            }
            let date = this.getDate();
            let file = path.join(outDir, date + '.log')
            let limitSize = this.#limitSize;
            if(limitSize > 0 && fs.existsSync(file)){
                let index = 0;
                while(index < 500){
                    let size = fs.statSync(file).size;
                    if(size >= limitSize){
                        file = path.join(outDir, date + `-${++index}.log`)
                        if(!fs.existsSync(file)){
                            break;
                        }
                    }else{
                        break;
                    }
                }
            }
            this.#lastTime = sec;
            this.#lastFile = file;
            return file;
        }
        return null
    }

    print(info, group=''){
        if(this.#active){
            let log = group ? `[${group}] ${info}` : info;
            let file = this.getFile();
            if(file){
                if(this.#formatDate){
                    let time = this.getDate(true)
                    log = `[${time}] ${log} \n`;
                }else{
                    log = `[${parseFloat(Date.now() / 1000).toFixed()}] ${log} \n`; 
                }
                this.write(file, log)
            }else{
                console.log(log)
            }
        }
    }

    write(file, log, append=true){
        try{
            if(append){
                fs.appendFileSync(file, log, {encoding:"utf-8"})
            }else{
                fs.writeFileSync(file, log, {encoding:"utf-8"})
            }
        }catch(e){
            try{
                let dir = path.dirname(file);
                if(!fs.existsSync(dir)){
                    fs.mkdirSync(dir)
                }
                if(append){
                    fs.appendFileSync(file, log, {encoding:"utf-8"})
                }else{
                    fs.writeFileSync(file, log, {encoding:"utf-8"})
                }
            }catch(e){
                console.error(`Logger write failed. file: ${file}\n ${e.message} \n ${e.stack}`)
            }
        }
    }

    mark(key){
        if(this.#active){
            this.#memoryRecords.set(key, process.memoryUsage().heapUsed);
        }
    }

    getMemoryUsage(key){
        if(this.#active){
            const mark = this.#memoryRecords.get(key);
            if(mark){
                const current = process.memoryUsage().heapUsed;
                return {
                    current:current > mark ? parseFloat((current - mark) / 1024 / 1024).toFixed(2) : 0,
                    total:current > memoryUsed ? parseFloat((current - memoryUsed) / 1024 / 1024).toFixed(2) : 0,
                };
            }
        }
        return defaultUsage;
    }

    getTotalMemoryUsage(){
        const current = process.memoryUsage().heapUsed;
        return current > memoryUsed ? parseFloat((current - memoryUsed) / 1024 / 1024).toFixed(2) : 0
    }
}

module.exports = Logger;