const path = require('path');
const fs = require('fs');
const fsExtra = require('fs-extra');
const hash = require('hash-sum');
const {emitFileTypes} = require('./types');
const Lang = require('../lib/core/Lang');
const Diagnostic = require('../lib/core/Diagnostic');
const { reportDiagnosticMessage } = require('../lib/core/Utils');
const mime = require('mime-types');
function parseResource(id) {
    const [resourcePath, rawQuery] = id.split(`?`, 2);
    const query = Object.fromEntries(new URLSearchParams(rawQuery));
    return {
        resourcePath,
        resource:id,
        query
    };
}

function transformError(error){
    let text = '';
    let location = null;
    if(error instanceof Diagnostic) {
        text = error.message;
        location = {
            file:error.file,
            line:error.range.start.line,
            column:error.range.start.column, 
            lineText:'Error code: '+error.code,
            namespace:'file'
        };
    }else if( error && error.text ){
        text = error.text;
        location = error.location || null;
    }else{
       text = String(error); 
    }
    return {
        text,
        location
    }
}

function base64Encode(file, content){
    const type = mime.lookup(file);
    return `data:${type};base64,${content}`;
}

const filter = /\.es(\?|$)/i;
const assetsFilter = /\.(css|less|sass|scss|png|gif|jpeg|jpg|svg|svgz|webp|bmp)$/i

const loader=(compile, options)=>{
    const plugins = compile.options.plugins;
    const hasOwn = Object.prototype.hasOwnProperty;
    const resolvePath = (file, baseDir)=>{
        if(path.isAbsolute(file)){
            return file;
        }
        return path.join(baseDir||compile.workspace, file);
    }

    const normalizePath=(compilation, resource, query={})=>{
        if( query.vue == void 0){
            return compile.normalizePath(resource)
        }
        return compile.normalizePath(compilation.file);
    }

    const getCompilation = (file)=>{
        const {resourcePath,query} = parseResource(file);
        const absPath = compile.normalizePath(path.isAbsolute(resourcePath) ? resourcePath : path.join(process.cwd(), resourcePath))
        const resourceId = compile.getResourceId(absPath);
        return compile.compilations.get(resourceId);
    }

    const createTypes=async (stat, outdir)=>{
        const outputs = stat.metafile.outputs;
        const datamap = new Map();
        Object.keys(outputs).forEach( dist=>{
            const stas = outputs[dist];
            const entryPoint = stas.entryPoint;
            const entryCompilation = entryPoint ? getCompilation(entryPoint) : null;
            const inputs = stas.inputs;
            const relativePath = './'+path.relative(outdir, dist);
            if(entryCompilation){
                datamap.set(entryCompilation, relativePath);
            }
            Object.keys(inputs).forEach(file=>{
                if(!filter.test(file))return;
                const compi = getCompilation(file)
                if(compi){
                    if(entryCompilation === compi){
                        datamap.set(compi, relativePath);
                    }else if(!datamap.has(compi)){
                        datamap.set(compi, null);
                    }
                }
            });
        });
        await emitFileTypes(datamap, outdir);
    }

    return {
        name:'easescript',
        async setup(build){

            await compile.initialize();

            const pluginInstances = plugins.map(config=>{
                const plugin = config.plugin;
                const options = config.options;
                if( typeof plugin ==='function' ){
                    return new plugin(compile,options);
                }
            });

            const outdir = resolvePath(build.initialOptions.outdir, compile.options.cwd || process.cwd());
            const clients = pluginInstances.filter(item=>item.platform ==='client');
            const servers = pluginInstances.filter(item=>item.platform ==='server');
            const compilations = new Set();
            const builder = clients[0];
            const isProduction = options.mode === 'production' || process.env.NODE_ENV === 'production';

            if(!builder){
                throw new Error('Builder is not exists.')
            }

            if(!builder.options.output){
                builder.options.output = outdir;
            }

            if(servers.length>0){
                compile.addListener('onParseDone',(compilation)=>{
                    servers.forEach( plugin=>{
                        if(compile.isPluginInContext(plugin, compilation)){
                            compilations.add(compilation)
                            plugin.build(compilation);
                        }
                    })
                })
            }

            build.onStart( (a)=>{
                if(options.clearOutdir===false)return;
                if(fs.existsSync(outdir)){
                    fsExtra.emptyDirSync(outdir);
                }   
            });

            build.onEnd( async(stat)=>{
                if(stat.errors.length)return;
                const errors = compile.errors.filter(err=>(err.kind === Diagnostic.ERROR));
                if(errors.length>0){
                    console.info(`${Lang.get('note')} ${Lang.get(100, errors.length)}`)
                }
                await createTypes(stat, outdir);
            });

            build.onDispose(()=>{
                compile.dispose();
            });

            build.onResolve({filter}, async args => {
                const file = resolvePath(args.path);
                if(options.excludeGlobalClassBundle){
                    const compi = getCompilation(file);
                    if(compi && compi.isGlobalDocument()){
                        const {query} = parseResource(args.path);
                        let id = query.id;
                        if(!id){
                            id = path.basename(compi.file, path.extname(compi.file));
                        }
                        return {
                            path:'esglobal:'+id,
                            namespace:'file',
                            external:true
                        }
                    }
                }
                return {path:file,namespace:'file'}
            });

            build.onLoad({filter, namespace:'file'}, args=>{
                return new Promise( async(resolve,reject)=>{
                    const {resourcePath,resource,query} = parseResource(args.path);
                    const compilation = await compile.ready(resourcePath);
                    const errors = compilation.errors.filter( error=>error.kind === Diagnostic.ERROR).map(transformError)
                    if(query.callhook != null && query.action){
                        try{
                            const code = await builder.callHook(query.action, compilation, query);
                            resolve({
                                contents:code,
                                loader:'js',
                                errors
                            });
                        }catch(e){
                            reject(e);
                        }
                        return;
                    }

                    compilations.add(compilation);
                    compilation.errors.forEach( error=>{
                        reportDiagnosticMessage(error)
                    });

                    let loader = query.type === 'style' ? 'css' : 'js';

                    builder.build(compilation, async (error)=>{
                        if(error){
                            reject(error);
                        }else{

                            const filepath = normalizePath(compilation, resource, query);
                            let code = builder.getGeneratedCodeByFile(filepath);
                            let sourcemap = builder.getGeneratedSourceMapByFile(filepath);

                            if(query.type === 'embedAssets'){
                                loader = 'text';
                            }

                            if(query && query.type === 'style' && query.file){
                                const lang = query.file.split('.').pop();
                                const preprocess = options.styles.preprocess;
                                if(hasOwn.call(preprocess, lang)){
                                    const preprocessor = options.styles.preprocess[lang];
                                    if(preprocessor){
                                        const result = await preprocessor({
                                            source:code,
                                            filename:resourcePath,
                                            resource,
                                            sourcemap,
                                            scopeId:query.scopeId,
                                            lang,
                                            isProd:isProduction
                                        });
                                        if(result){
                                            if(Array.isArray(result.errors)){
                                                errors.push( ...result.errors.map(transformError) );
                                            }
                                            code =result.code;
                                            if(result.map || result.sourcemap){
                                                sourcemap = result.sourcemap || result.map;
                                            }
                                        }
                                    }
                                }
                            }

                            if( !query.type ){
                                if(sourcemap){
                                    const extname = path.extname(resourcePath);
                                    const name = path.basename(resourcePath, extname);
                                    const key = hash(resource);
                                    const basedir = path.join(outdir,'.map');
                                    fsExtra.mkdirpSync(basedir);
                                    sourcemap = JSON.stringify(sourcemap);
                                    let mappath = path.join(basedir, `${name}-${key}${extname}.map`);
                                    fs.writeFileSync(mappath,sourcemap);
                                    code += '\n//# sourceMappingURL=data:application/json;base64,'+Buffer.from(sourcemap).toString('base64');
                                }
                            }
                            
                            resolve({
                                contents:code,
                                loader,
                                errors
                            });
                        }
                    })
                })
            });

            build.onLoad({filter:assetsFilter, namespace:'file'}, async args=>{
                let resolvePath = args.path;
                if( fs.existsSync(resolvePath) ){
                    let errors = [];
                    let code = fs.readFileSync(resolvePath);
                    let name = path.extname(resolvePath).toLowerCase();
                    let lang = name.slice(1);
                    let loader = options.loaders[name] || 'file';
                    let base64Callback = options.assets.base64Callback;
                    if(base64Callback && base64Callback(resolvePath)===true){
                        code = base64Encode(resolvePath, code.toString('base64'));
                        loader = 'text';
                    }

                    let preprocess = options.styles.preprocess;
                    if(hasOwn.call(preprocess,lang)){
                        let preprocessor = preprocess[lang];
                        const result = await preprocessor({
                            source:code,
                            filename:resolvePath,
                            resource:resolvePath,
                            lang:lang,
                            isProd:isProduction
                        });
                        if(result){
                            if(Array.isArray(result.errors)){
                                errors.push( ...result.errors.map(transformError) );
                            }
                            code =result.code;
                        }
                    }

                    return {
                        contents:code,
                        loader:loader,
                        errors
                    }
                }
            });

            Object.keys(options.resolve.alias).forEach( key=>{
                const filter = new RegExp(key);
                const replacePath = options.resolve.alias[key];
                build.onResolve({filter, namespace:'file'}, async args=>{
                    if(args.kind!=='import-statement')return;
                    let resolvePath = args.path;
                    let path2 = resolvePath.replace(filter, (prefix)=>{
                        return path.join(replacePath,prefix);
                    });
                    let result = await build.resolve(path2, {kind:args.kind,resolveDir:path.dirname(path2)});
                    if(result && !result.errors.length){
                        return result;
                    }
                })
            });

        }
    }
}

module.exports = loader;