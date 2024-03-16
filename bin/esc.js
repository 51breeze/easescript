#!/usr/bin/env node  
const program = require('commander');

program.option('-V, --version', '当前版本号');
program.on('option:version', function() {
    const version = 'EaseScript '+require('../package.json').version;
    process.stdout.write(version + '\n');
    process.exit(0);
});

program.description('The command currently running is the easescript compiler.\n  which can build different target run code based on different syntax plugins')

program.usage('--file <file, ...> [options]')

program
.option('-f, --file <file>', '指定需要编译的文件',(val)=>{
    return val ? val.split(',') : [];
})
.option('-c, --config-file-name [file]', '指定配置文件','es.config.js')
.option('-o, --output [dir]', '输出路径','./build')
.option('-p, --plugins [javascript,php]', '构建插件',function (val) {
    return val ? val.split(',') : [];
})
.option('-s, --suffix [.es]', '源文件的后缀名','.es')
.option('-l, --lang [zh-CN]', '语言','zh-CN')
.option('-w, --workspace [dir]', '源文件目录', process.cwd() )
.option('-r, --reserved [keyword1,keyword2,...]', '指定需要保护的关键字', function (val) {
    return val ? val.split(',') : [];
})
.option('-t, --types [file.d.es, ...]', '指定描述文件', function (val) {
    return val ? val.split(',') : [];
})
.option('-mode, --mode [dev|test|production]', '构建模式是用于生产环境还是测试环境','production')
.option('-format, --format [esm]', '文件输出格式(iife,cjs,esm)','esm')
.option('-platform, --platform [node]', '运行平台(node,browser,neutral)','node')
.option('--debug', '是否打印调试信息',false)
.option('--throw-error', '当有错误时直接抛出',false)
.option('--minify', '启用压缩')
.option('--watch', '监视文件，当有文件变动时重新构建')
.option('--unbundle', '取消捆绑')
.option('--sourcemap', '生成源码映射')
.option('--exclude-global-class-bundle', '当导入全局类时设置为外部引用，来共享全局类的代码')

program.parse(process.argv);

if( process.argv.length < 3 || !program.file ){
    program.outputHelp();
    process.exit(1);
}

const config = [
   "file",
   "configFileName",
   "throwError",
   "output",
   "plugins",
   "suffix",
   "types",
   "debug",
   "reserved",
   "mode",
   "format",
   "watch",
   "sourcemap",
   "platform",
   "workspace",
   "minify",
   "unbundle"
];
const options = {
    debug:false,
    throwError:false,
    minify:false,
    bundle:true,
    excludeGlobalClassBundle:false,
    mode:'production'
};
config.forEach( name=>{
    if( program[name] !== void 0 ){
        options[name] = program[name];
    }
    if(name==='unbundle' && program[name]){
        options['bundle'] = false;
    }
});
options.commandLineEntrance = true;
const compile = require('../compile/index.js');
compile(options);
