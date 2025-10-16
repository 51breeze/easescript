module.exports = {
    debug:true,
    workspace:'test/src',
    scopes:[
        {
            name:"thinkphp",
            include:[
                /[\\\/]api[\\\/]/,
            ],
            inherit:['php'],
            common:/[\\\/]com[\\\/]/,
            // resolve:[
            //     /[\\\/]Test\.es/
            // ],
            only:true
        },
        {
            name:"vue",
            include:[
                /[\\\/]front[\\\/]/,
            ],
            common:/[\\\/]com[\\\/]/,
            inherit:['es-javascript'],
            only:true
        },
       
    ],
    plugins:[
        // {
        //     name:'es-javascript',
        //     plugin:require('../es-javascript'),
        //     options:{
        //         useAbsolutePathImport:true,
        //         sourceMaps:true,
               
        //     }
        // }
    ]
}