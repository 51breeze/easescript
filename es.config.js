module.exports = {
    workspace:'test/src',
    plugins:[
        {
            name:'es-javascript',
            plugin:require('../es-javascript'),
            options:{
                useAbsolutePathImport:true,
                sourceMaps:true
            }
        }
    ]
}