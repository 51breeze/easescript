
const esbuild = require('esbuild');
const path = require('path');
const merge  = require("lodash/merge");
const loader = require('./loader');

function formatMessage(){
    // let message = ['Build successful!'];
    // if(errors.length>0){
    //     message.push(`Note: there ${chalk.red(`has ${errors.length} errors`)} that need to be improved.`);
    // }

    // let strLen = 0;
    // let hideMaxLen = 0;
    // let hideChars = ['\x1B[31m','\x1B[39m'];
    // message.forEach( item=>{
    //     let len = 0;
    //     hideChars.forEach( match=>{
    //         if( item.includes(match) ){
    //             len+=match.length;
    //         }
    //     });
    //     if(len>0){
    //         hideMaxLen = Math.max(len, hideMaxLen);
    //     }
    //     strLen = Math.max(strLen, item.length);
    // });

    // let sep =  '*'.repeat(strLen-hideMaxLen+10);
    // let format = ()=>{
    //     let padding = '   ';
    //     return message.map( item=>{
    //         item = item.padEnd(strLen-(padding.length*2)-4);
    //         item = padding+item+padding;
    //         item = sep.slice(0,2) +item + sep.slice(-2);
    //         return item;
    //     }).join('\n');
    // }
    // if(errors.length>0){
    //     const orange = chalk.keyword('orange');
    //     console.warn(orange(`${sep}\n${format()}\n${sep}`))
    // }else{
    //     console.info(chalk.bgGreen(`${sep}\n${format()}\n${sep}`))
    // }
}

module.exports = async(options)=>{
    let files = options.file;
    if(!Array.isArray(files)){
        files = [files];
    }

    options = merge({
        diagnose:true,
        enableComments:true,
        lang:'zh-CN',
        exitWhenHasErrors:false
    }, options);

    const entryPoints = {};
    files.forEach(file=>{
        entryPoints[path.basename(file,'.es').toLowerCase()] = file;
    });

    options.plugins = [
        {
            name:'es-javascript',
            plugin:require('../../es-javascript'),
            options:{
                useAbsolutePathImport:true,
                sourceMaps:true
            }
        }
    ]

    esbuild.build({
        entryPoints,
        chunkNames: 'deps/[hash]',
        splitting:true,
        bundle: true,
        outdir: options.output,
        format: 'esm',
        platform: 'node',
        metafile:true,
        minify:false,
        sourcemap:'linked',
        resolveExtensions:['.es','.jsx','.js','.css','.less','.scss','.json'],
        define: { 'process.env.NODE_ENV': '"production"' },
        plugins: [
            loader(options)
        ],
      }).then( (res)=>{
        console.log('\nBuild done.\n')
      }).catch((e) =>{
        console.log( e )
        console.log('\nBuild error.\n')
        process.exit(1);
      });
    
}