#!/usr/bin/env node  
const program = require('commander');
program
.version('EaseScript '+require('../package.json').version)
.option('-f, --file [file]', '指定需要编译的文件',(val)=>{
    return val ? val.split(',') : [];
})
.option('-c, --config-file-name [file]', '指定配置文件','es.config.js')
.option('-o, --output [dir]', '输出路径','./build')
.option('-p, --plugins [javascript,php]', '语法构建器',function (val) {
    return val ? val.split(',') : [];
})
.option('-s, --suffix [value]', '源文件的后缀名','.es')
.option('-w, --workspace [dirname]', '源文件目录', process.cwd() )
.option('-r, --reserved [keyword1,keyword2,...]', '指定需要保护的关键字', function (val) {
    return val ? val.split(',') : [];
})
.option('-t, --types [t1.d.es,t2.d.es,...]', '指定描述文件', function (val) {
    return val ? val.split(',') : [];
})
.option('-e, --env [dev|test|production]', '构建模式是用于生产环境还是测试环境','production')
.option('-dd, --describe-dirname [dirname]', '描述文件目录名','types')
.option('--ddf, --disable-describe-file', '禁用用自动加载描述文件',false)
.option('--debug', '是否开启调试',false)
.option('--throw-error', '显示错误',false)
program.parse(process.argv);
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
   "env",
   "workspace",
   "autoLoadDescribeFile",
];
const options = {
    env:{
        mode:'production'
    }
};
config.forEach( name=>{
    if( program[name] ){
        if( name==='env' ){
            options.env.mode = program[name];
        }else{
            options[name] = program[name];
        }
    }
    if(name === 'autoLoadDescribeFile'){
        options[name] = !program['disableDescribeFile'];
    }
});
options.commandLineEntrance = true;
const compile = require('../compile/index.js');
compile(options);
