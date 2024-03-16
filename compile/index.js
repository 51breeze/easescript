
const esbuild = require('esbuild');
const loader = require('./loader');
//const chalk = require('chalk');
const Compiler = require('../lib/core/Compiler');
// function formatMessage(outdir){
//     let message = [
//         'Build successful!',
//         `Output:${outdir}`
//     ];

//     let strLen = 0;
//     let hideMaxLen = 0;
//     let hideChars = ['\x1B[31m','\x1B[39m'];
//     message.forEach( item=>{
//         let len = 0;
//         hideChars.forEach( match=>{
//             if( item.includes(match) ){
//                 len+=match.length;
//             }
//         });
//         if(len>0){
//             hideMaxLen = Math.max(len, hideMaxLen);
//         }
//         strLen = Math.max(strLen, item.length);
//     });

//     let sep =  '*'.repeat(strLen-hideMaxLen+10);
//     let format = ()=>{
//         let padding = '   ';
//         return message.map( item=>{
//             item = item.padEnd(strLen-(padding.length*2)-4);
//             item = padding+item+padding;
//             item = sep.slice(0,2) +item + sep.slice(-2);
//             return item;
//         }).join('\n');
//     }
//     console.info(chalk.green(`${sep}\n${format()}\n${sep}`))
// }

module.exports = async(options)=>{
    let files = options.file;
    if(!Array.isArray(files)){
        files = [files];
    }

    const compilerOptions = {
        diagnose:true,
        enableComments:true,
        lang:'zh-CN',
        configFileName:null,
        suffix:null,
        workspace:null,
        reserved:null,
        throwError:null,
        types:null,
    }

    Object.keys(compilerOptions).forEach(key=>{
        if( options[key] ){
            compilerOptions[key] = options[key];
        }else if(compilerOptions[key]===null){
            delete compilerOptions[key];
        }
    });

    let escOptions = {};
    escOptions.define = {
        'process.env.NODE_ENV':`"${options.mode}"`
    };

    compilerOptions.esc = escOptions;
    Object.keys(options).forEach( key=>{
        if(!Object.prototype.hasOwnProperty.call(compilerOptions, key)){
            escOptions[key] = options[key];
        }
    });

    const compile = new Compiler(compilerOptions);
    escOptions = compile.options.esc;

    const plugins = escOptions.plugins || [];
    plugins.unshift( loader(compile, escOptions) );

    const esbuildOptions = {
        entryPoints:files,
        entryNames:escOptions.entryNames || '[name]',
        chunkNames:escOptions.chunkNames || 'deps/[hash]',
        splitting:escOptions.splitting ? true : files.length>1,
        bundle: escOptions.bundle,
        outdir: escOptions.output,
        format: escOptions.format || 'esm',
        platform: escOptions.platform || 'node',
        metafile:true,
        loader:escOptions.loaders,
        treeShaking:escOptions.treeShaking,
        nodePaths:escOptions.resolve.paths,
        minify:escOptions.minify,
        sourcemap:!!escOptions.sourcemap,
        resolveExtensions:escOptions.resolve.extensions,
        define:escOptions.define,
        plugins,
    };

    if(escOptions.watch){
        esbuild.context(esbuildOptions).then( async ctx=>{
            await ctx.watch();
            console.info('[ES] Starting compilation in watch mode...')
        }).catch(e=>{
            console.error( e )
        });
    }else{
        esbuild.build(esbuildOptions).then( res=>{
            if(res.errors.length>0){
                console.info(`Build done. but found ${res.errors.length} errors`)
            }else{
                console.info('\n[ES] Build done.\n')
            }
        }).catch(e=>{
            console.error(e)
        });
    }
    
}