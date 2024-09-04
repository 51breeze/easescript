const Compiler = require('./lib/core/Compiler')

const com = new Compiler()


const result = com.resolveRuleFiles('components/*')


console.log( result )