const path = require('path')
const slashDelimitRegexp = /(?<!\\)[\/]+/;
const keyScheme = Symbol('scheme');
class Glob{

    #rules = [];
    #initialized = false;
    #cache = {};
    #extensions = {};

    addExt(group, ext){
        this.#extensions[group] = ext;
    }

    addExts(data={}){
        Object.keys(data).forEach(key=>{
            this.#extensions[key] = data[key];
        });
    }

    addRules(rules, group=null, data={}){
        Object.keys(rules).forEach(key=>{
            this.addRule(key,data[key],0,group,data);
        });
    }

    addRule(pattern, target, priority=0, group=null, data={}){
        let type = pattern instanceof RegExp ? 'regexp' : typeof pattern;
        let method = typeof target;
        let segments = [];
        let asterisks = 0;
        if(type ==='string'){
            pattern = pattern.trim();
            segments =  pattern.replace(/^\/|\/$/).split(slashDelimitRegexp);
            asterisks = (pattern.match(/(?<!\\)\*/g)||[]).length;
            if(pattern.includes('****')){
                if(segments.length>1){
                    throw new TypeError(`Glob the '****' full match pattern cannot have separator.`)
                }
            }else if(pattern.includes('***')){
               const at = pattern.indexOf('***');
               if(at<pattern.length-3){
                    throw new TypeError(`Glob the '***' full match pattern should is at the pattern ends.`)
               }
            }else if(/\*\*\.\w+$/.test(pattern)){
                throw new TypeError(`Glob the '**.ext' file match pattern should have a separator between the two asterisks. as the '*/*.ext'`)
            }else if(/\*{4,}/.test(pattern)){
                throw new TypeError(`Glob the '***' full match pattern should is three asterisks.`)
            }
        }else if( !(type ==='regexp' || type ==='function') ){
            throw new TypeError(`Glob pattern must is regexp or string or function`)
        }

        if(method==='function'){
            method = true;
        }else if(method ==='string'){
            method = false;
        }else if(target){
            throw new TypeError(`Glob the 'target' argument must is string or function`)
        }
        this.#rules.push({
            pattern,
            target,
            segments,
            asterisks,
            priority,
            group,
            type,
            method,
            data,
            setValue(prefix, name, value){
                if(arguments.length===2){
                    return data[prefix] = name;
                }else if(arguments.length===3){
                    let dataset = data[prefix] || (data[prefix] = {});
                    return dataset[name] = value;
                }
                return false;
            },
            getValue(prefix, name=null){
                if(arguments.length===1){
                    return data[prefix];
                }
                let dataset = data[prefix] || (data[prefix] = {});
                return dataset[name]
            }
        });
        this.#initialized=false;
    }

    removeRules(){
        this.#initialized=false;
        return this.#rules.splice(0, this.#rules.length);
    }

    removeRule(pattern){
        this.#initialized=false;
        pattern = typeof pattern === 'function' ? pattern : (rule)=>rule.pattern === pattern;
        const index = this.#rules.findIndex(pattern);
        if(index>=0){
            return this.#rules.splice(index, 1)
        }
        return null;
    }

    #init(){
        this.#rules.sort((a, b)=>{
            if(a.priority<b.priority)return -1;
            if(a.priority>b.priority)return 1;

            if(a.type==='regexp' || a.type==='function')return -1;
            if(b.type==='regexp' || b.type==='function')return 1;

            if(a.asterisks===0)return -1;
            if(b.asterisks===0)return 1;

            let a1 = a.segments.length;
            let b1 = b.segments.length;
            if(a1>b1)return -1;
            if(a1<b1)return 1;
            let a2 = a.asterisks;
            let b2 = b.asterisks;
            return a2 - b2;
        });
        this.#initialized=true;
    }

    matchRule(paths, segments, basename, extname, globs=[]){
        let len = paths.length-1;
        let base = paths[len];
        let globPos = -1;
        globs.length = 0;
        if(segments.length < len)return false;
        if(base==='****'){
            globs.push(segments.slice(0, -1));
            return true;
        }

        if(base!=='***'){
            if(extname && !(base.endsWith(extname) || base.endsWith('.*'))){
                return false;
            }else if(basename !== base && !base.startsWith('*')){
                return false;
            }else if(base.includes('.') && !extname){
                return false;
            }
        }

        const push=(end)=>{
            if(globPos>=0){
                globs.push(segments.slice(globPos,end));
                globPos = -1;
            }
        }
        let offset = 0;
        let at = 0;
        for(let i=0;i<len;i++){
            let segment = paths[i];
            at = offset+i;
            if(segment === segments[at]){
                push(at)
                continue;
            }else if(segment==='**'){
                let next = paths[i+1];
                if(next && !next.startsWith('*') && next !== base){
                    let start = at;
                    while(start<segments.length && (next !== segments[++start]));
                    if(next !== segments[start]){
                        return false;
                    }
                    offset = start-at-1;
                }
                globPos = at;
                continue;
            }else if(segment ==='*'){
                push(at)
                globs.push([segments[at]]);
                continue;
            }
            return false;
        }
        push(-1);
        if(base==='*'){
            at++;
            if(at < segments.length-1)return false;
        }else if(base==='**' || base==='***'){
            at++;
            globPos = at;
            push(-1);
        }
        return true;
    }

    scheme(id, ctx={}, excludes=null){
        if(!this.#initialized){
            this.#init();
        }
        let normalId = String(id).trim().replace(/\\/g,'/').replace(/^\/|\/$/);
        let group = ctx.group;
        let extname = ctx.extname || this.#extensions[group] || null;
        let delimiter = ctx.delimiter || '/';
        let key = [normalId,String(group),delimiter,String(extname)].join(':')
        if(!excludes && this.#cache.hasOwnProperty(key)){
            return this.#cache[key];
        }
        let segments = normalId.split(slashDelimitRegexp);
        let basename = segments[segments.length-1];
        let dotAt = basename.lastIndexOf('.');
        let result = null;
        let globs = [];
        if(dotAt>=0){
            if(!extname){
                extname = basename.slice(dotAt);
            }
            basename = basename.substring(0, dotAt);
        }

        for(let rule of this.#rules){
            if(excludes){
                if(excludes===rule)continue;
                if(Array.isArray(excludes) && excludes.includes(rule))continue;
            }
            if(group && rule.group && rule.group !== group){
                continue;
            }
            if(rule.type==='function'){
                if(rule.pattern(id, ctx, rule)){
                    result = rule;
                    break;
                }
            }else if(rule.type==='regexp'){
                if(rule.pattern.test(id)){
                    result = rule;
                    break;
                }
            }else if(rule.pattern===id || rule.pattern===normalId){
                result = rule;
                break;
            }else if(this.matchRule(rule.segments, segments, basename, extname, globs)){
                result = rule;
                break;
            }
        }

        const args = result ? globs.flat() : [];
        return this.#cache[key] = {
            segments,
            basename,
            extname,
            args,
            globs,
            id,
            normalId,
            rule:result,
            value:null,
            [keyScheme]:true
        }
    }

    dest(id, ctx={}){
        return this.parse(this.scheme(id, ctx), ctx);
    }

    parse(scheme, ctx={}){
        const defaultValue = ctx.failValue !== void 0 ? ctx.failValue : false;
        if(!scheme || !scheme.rule || scheme[keyScheme]!==true)return defaultValue;
        const {basename,extname,rule,args,value, id} = scheme;
        if(!rule.target){
            return rule.target;
        }
        if(value){
            return value;
        }
        if(rule.method){
            let _result = rule.target(id, scheme, ctx, this);
            let _scheme = scheme;
            let _excludes = [rule];
            while(_result === void 0){
                _scheme = this.scheme(_scheme.id, ctx, _excludes)
                if(_scheme && _scheme.rule){
                    _excludes.push(_scheme.rule);
                    _result = this.parse(_scheme, ctx)
                }else{
                    break;
                }
            }
            return scheme.value = _result;
        }
        const delimiter = ctx.delimiter || '/';
        const _value = rule.target.replace(/(?<!\\)\{(.*?)\}/g, (_, name)=>{
            name = name.trim();
            if(name.startsWith('...')){
                name = name.substring(3).trim();
                if(!name){
                    return args.join('/')
                }
            }
            if(name.startsWith('globs')){
                try{
                    let _globs = eval(`(${name.replace(/\bglobs\b/g,'scheme.globs')})`);
                    _globs = Array.isArray(_globs) ? _globs.flat() : [_globs];
                    return _globs.join('/')
                }catch(e){
                    throw new ReferenceError(`${name} expression invalid`)
                }
            }else if(name==='basename'){
                return `${basename}${extname||''}`;
            }else if(name==='filename'){
                return basename;
            }else if(name==='extname'){
                return (extname||'').substring(1);
            }else if(name==='ext'){
                return extname||'';
            }else if(/-?\d+/.test(name)){
                if(name[0]==='-'){
                    name = args.length - Number(name.substring(1));
                }
                return args[name] || '';
            }else if(name==='group'){
                return ctx[name] || '';
            }
            if(ctx.data && Object.prototype.hasOwnProperty.call(ctx.data, name)){
                return String(ctx.data[name]);
            }
            return '';
        });
        return scheme.value = path.normalize(_value).split(/[\\\/]+/).filter(Boolean).join(delimiter);
    }

}

module.exports = Glob;

