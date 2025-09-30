const Compiler = require('./core/Compiler.js');
const Compilation = require('./core/Compilation.js');
const Constant= require('./core/Constant.js');
const Namespace= require('./core/Namespace.js');
const Utils= require('./core/Utils.js');
const JSModule= require('./core/JSModule.js');
const Module= require('./core/Module.js');
const Inference= require('./core/Inference.js');
const Diagnostic= require('./core/Diagnostic.js');
const Manifester= require('./core/Manifester.js');
const ScopeManager= require('./core/ScopeManager.js');
const ResolveManager= require('./core/ResolveManager.js');
const {acorn, parseJSX, Parser}= require('./core/Parser.js');
module.exports = {
    Compiler,
    Compilation,
    Constant,
    Namespace,
    Utils,
    JSModule,
    Module,
    Inference,
    Diagnostic,
    Manifester,
    ScopeManager,
    ResolveManager,
    acorn,
    parseJSX,
    Parser
};