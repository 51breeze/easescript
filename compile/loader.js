const Compiler = require('../lib/core/Compiler');
const path = require('path');
const merge  = require("lodash/merge");
const fs = require('fs');
const fsExtra = require('fs-extra');
const {emitFileTypes} = require('./types');
const Lang = require('../lib/core/Lang');
const Utils = require('../lib/core/Utils');
const Diagnostic = require('../lib/core/Diagnostic');
const { reportDiagnosticMessage } = require('../lib/core/Utils');
function parseResource(id) {
    const [resourcePath, rawQuery] = id.split(`?`, 2);
    const query = Object.fromEntries(new URLSearchParams(rawQuery));
    return {
        resourcePath,
        resource:id,
        query
    };
}

const filter = /\.es(\?|$)/i;
const assetsFilter = /\.(html|css|less|sass|scss|png|gif|jpeg|jpg|svg|json)$/i
const defaultLoaderExtensions = {
    'text':['.html','.svg'],
    'json':['.json'],
    'css':['.css','.less','.sass','.scss'],
    'dataurl':['.png','.gif','.gif','.jpeg','.jpg'],
}

const loader=(options)=>{
    
    const compile = new Compiler(options);
    const plugins = compile.options.plugins;
    const loaderExtensions = merge({},defaultLoaderExtensions,options.loaderExtensions);
    const resolveLoader = {};
    const resolvePath = (file, baseDir)=>{
        if(path.isAbsolute(file)){
            return file;
        }
        return path.join(baseDir||compile.workspace, file);
    }

    const normalizePath=(compilation, query={})=>{
        return compile.normalizeModuleFile(compilation, query.id, query.type, query.file)
    }

    Object.keys(loaderExtensions).forEach((loader)=>{
        if(Array.isArray(loaderExtensions[loader])){
            const extensions = loaderExtensions[loader];
            extensions.forEach( ext=>{
                resolveLoader[ext] = loader
            });
        }
    });

    return {
        name:'easescript',
        async setup(build){
            
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
               
                const outputs = stat.metafile.outputs;
                const datamap = new Map();

                //console.log( outputs )
                Object.keys(outputs).forEach( emitFile=>{
                    const stas = outputs[emitFile];
                    const inputs = stas.inputs;
                    const relativePath = path.relative(outdir, emitFile);
                    Object.keys(inputs).forEach(file=>{
                        if(!filter.test(file))return;
                        const {resourcePath,query} = parseResource(file);
                        const absPath = compile.normalizePath(path.join(process.cwd(), resourcePath))
                        const resourceId = compile.getResourceId(absPath);
                        const compi = compile.compilations.get(resourceId);
                        if(compi){
                            datamap.set(compi, relativePath);
                        }
                    });
                });
                await emitFileTypes(datamap, outdir);

            });

            build.onDispose(()=>{
                compile.dispose();
            });

            build.onResolve({filter}, async args => {
                return {path:resolvePath(args.path) }
            });

            build.onLoad({filter}, args=>{
                return new Promise( async(resolve,reject)=>{
                    const {resourcePath,query} = parseResource(args.path);
                    const compilation = await compile.ready(resourcePath);
                    compilations.add(compilation);
                    compilation.errors.forEach( error=>{
                        reportDiagnosticMessage(error)
                    });

                    if(options.exitWhenHasErrors){
                        if(compilation.errors.some(error=>error.kind ===Diagnostic.ERROR)){
                            reject(new Error(Lang.get(101)));
                            return;
                        }
                    }

                    builder.build(compilation,(error)=>{
                        if(error){
                            reject(error);
                        }else{
                            const filepath = normalizePath(compilation, query);
                            let code = builder.getGeneratedCodeByFile(filepath);
                            let sourcemap = builder.getGeneratedSourceMapByFile(compilation.file);
                            if(sourcemap){
                                code += '\n//# sourceMappingURL='+JSON.stringify(sourcemap);
                            }
                            resolve({
                                contents:code,
                                loader:query.type === 'style' ? 'css' : 'js',
                            })
                        }
                    })
                })
            });

            build.onResolve({filter:assetsFilter}, async args => {
                return {path:resolvePath(args.path)}
            });

            build.onLoad({filter:assetsFilter}, async args=>{
                let code = fs.readFileSync(args.path)
                let name = path.extname(args.path).toLowerCase();
                return {
                    contents:code,
                    loader:resolveLoader[name] || 'file',
                }
            });
        }
    }
}

module.exports = loader;