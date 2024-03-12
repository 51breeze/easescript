const chalk = require('chalk');
const chalkInfo = chalk.keyword('orange')
const chalkBgWarn = chalk.bgMagenta
const chalkWarn = chalk.magenta;

const messages = {};
const langIndexs = [0,1];
var langId = 0;
function define(code, value){
    messages[code] = value;
}

define('note',[
    chalk.bgRed('[提示]'),
    chalk.bgRed('[Note]')
]);

define('error',[
    `${chalk.red('✘')} ${chalk.bgRed('[错误]')}`,
    `${chalk.red('✘')} ${chalk.bgRed('[Error]')}`,
]);

define('warn',[
    `${chalkWarn('※')} ${chalkBgWarn('[警告]')}`,
    `${chalkWarn('※')} ${chalkBgWarn('[Warn]')}`,
]);

define('info',[
    chalkInfo('☞ [信息]'),
    chalkInfo('☞ [Info]')
]);

define(100,[
    `有${chalk.red(' %s ')}个编译错误需要修复。请关注输出信息`,
    `there ${chalk.red('has %s errors')} compilation that need to be fixed. please review the output`
]);

define(101,[
    `在编译过程中发现了一些错误，需要先更正之后再构建`,
    `There has errors found during compilation that need to corrected before building`
]);

function getMessage(langId, code, args=[]){
    let dataset = messages[code];
    let value = dataset ? dataset[langId] : null;
    if(!value){
        value = 'unknown';
        if(typeof code ==='string'){
            value = code;
        }
        return value;
    }
    let index = 0;
    
    return value.replace(/(?<!\\)(%([s|S]|\d+))/g, (name)=>{
        const at = parseInt(name.substr(1,1));
        const result = at > 0 ? args[at-1] : args[index++];
        return result === void 0 ? 'unknown' : result;
    });

}

module.exports = {
    setLangId(value){
        if(langIndexs.includes(value)){
            langId = value;
        }else{
            throw new Error(`Lang index invaild. allow indexs [${langIndexs.join(',')}]`)
        }
    },
    getLangId(){
        return langId;
    },
    define,
    get(code, ...args){
        return getMessage(langId, code, args);
    },
    fetch(id, code, ...args){
        return getMessage(id, code, args);
    },
    has(code){
        return Object.prototype.hasOwnProperty.call(messages,code);
    },
    make(langId){
        if(!langIndexs.includes(langId)){
            throw new Error(`Lang index invaild. allow indexs [${langIndexs.join(',')}]`)
        }
        return (code, ...args)=>{
           return getMessage(langId, code, args);
        }
    }
}