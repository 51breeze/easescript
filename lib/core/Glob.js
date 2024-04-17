const path = require('path')
const slashDelimitRegexp = /(?<!\\)[\/]+/;
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

    addRule(pattern, target, priority=0, group=null){
        let type = pattern instanceof RegExp ? 'regexp' : 'string';
        let method = typeof target;
        let segments = [];
        let asterisks = 0;
        if(type ==='string'){
            pattern = pattern.trim();
            segments =  pattern.replace(/^\/|\/$/).split(slashDelimitRegexp);
            asterisks = pattern.match(/(?<!\\)\*/g).length;
            if(pattern.includes('***')){
                if(segments.length>1){
                    throw new TypeError(`Glob the '***' full match pattern cannot have separator.`)
                }
            }else if(/\*\*\.\w+$/.test(pattern)){
                throw new TypeError(`Glob the '**.ext' file match pattern should have a separator between the two asterisks. as the '*/*.ext'`)
            }else if(/\*{4,}/.test(pattern)){
                throw new TypeError(`Glob the '***' full match pattern should is three asterisks.`)
            }
        }

        if(method==='function'){
            method = true;
        }else if(method ==='string'){
            method = false;
        }else{
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
            method
        });
        this.#initialized=false;
    }

    init(){
        this.#rules.sort((a, b)=>{
            if(a.priority<b.priority)return -1;
            if(a.priority>b.priority)return 1;
            let a1 = a.type === 'string' ? a.segments.length : -1;
            let b1 = b.type === 'string' ? b.segments.length : -1;
            if(a1>b1)return -1;
            if(a1<b1)return 1;
            let a2 = a.type === 'string' ? a.asterisks : -1;
            let b2 = b.type === 'string' ? b.asterisks : -1;
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
        if(base==='***'){
            globs.push(segments.slice(0, -1));
            return true;
        }
        if(extname && !(base.endsWith(extname) || base.endsWith('.*'))){
            return false;
        }else if(basename !== base && !base.startsWith('*')){
            return false;
        }else if(base.includes('.') && !extname){
            return false;
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
            if(segments[at]){
                if(at < segments.length-1)return false;
                globs.push([segments[at]]);
            }
        }else if(base==='**'){
            at++;
            globPos = at;
            push(segments.length);
        }
        return true;
    }

    resolveRule(id, ctx={}){
        if(!this.#initialized){
            this.init();
        }
        id = String(id).trim().replace(/\\/g,'/').replace(/^\/|\/$/);
        let group = ctx.group;
        let extname = ctx.extname || this.#extensions[group] || null;
        let delimiter = ctx.delimiter || '/';
        let key = [id,String(group),delimiter,String(extname)].join(':')
        if(this.#cache.hasOwnProperty(key)){
            return this.#cache[key];
        }
        let segments = id.split(slashDelimitRegexp);
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
            if(group && rule.group !== group){
                continue;
            }
            if(rule.type==='regexp'){
                if(rule.pattern.test(id)){
                    result = rule;
                    break;
                }
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
            rule:result,
            value:null
        }
    }

    dest(id, ctx={}){
        const result = this.resolveRule(id, ctx);
        if(!result.rule)return null;
        const {basename,extname,rule,args,value} = result;
        if(value){
            return value;
        }
        if(rule.method){
            return result.value = rule.target(id, result, ctx);
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
                    let _globs = eval(`(${name.replace(/\bglobs\b/g,'result.globs')})`);
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
        return result.value = path.normalize(_value).split(/[\\\/]+/).filter(Boolean).join(delimiter);
    }

}

module.exports = Glob;

