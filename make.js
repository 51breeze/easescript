const fs = require("fs");
const path = require("path");
const modules = {};
const files = fs.readdirSync('./lib/stacks');
const content = ['const tokens={};'];
content.push(`const Stack=require('./core/Stack.js');`)
content.push(`const create=function(compilation,node,scope,parentNode,parentStack){
    if( !node ){
        return null;
    }
    switch( node.type ){
        case "MethodDefinition":
            if( node.kind === "get"){
                return new tokens.MethodGetterDefinition(compilation,node,scope,parentNode,parentStack);
            }else if( node.kind === "set"){
                return new tokens.MethodSetterDefinition(compilation,node,scope,parentNode,parentStack);
            }
            return new tokens.MethodDefinition(compilation,node,scope,parentNode,parentStack);
        case "Super":
            return new tokens.SuperExpression(compilation,node,scope,parentNode,parentStack);
        default :
            const stackClass = tokens[ node.type ];
            if( stackClass ){
                return new stackClass(compilation,node,scope,parentNode,parentStack);
            }else{
                compilation.error(node, 1189, node.type);
            }
    }
};`);

files.forEach( (file)=>{
    const info = path.parse(file)
    if( info.name != "index"){
        content.push(`tokens.${info.name}=require('./stacks/${file}');`)
    }
});
content.push(`for(var name in tokens){
    tokens[name].prototype.toString=(function(name){
        return function(){return name};
    }(name));
}`);
content.push(`Stack.create=create;`);
content.push(`module.exports={'tokens':tokens,'create':create};`)
fs.writeFileSync(  path.join(__dirname,'./lib/tokens.js'), content.join('\r\n') )

