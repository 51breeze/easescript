const Stack = require("../core/Stack");
class VariableDeclaration extends Stack {
    constructor(compilation,node,scope,parentNode,parentStack){ 
        super(compilation,node,scope,parentNode,parentStack);
        this.isVariableDeclaration= true;
        this.kind = node.kind;
        this.declarations = node.declarations.map( item=>{
            return this.createTokenStack(compilation,item, scope, node,this);
        });
        this.flag = false;
        switch( parentNode && parentNode.type ){
            case "ForStatement":
            case "ForInStatement":
            case "ForOfStatement":
                this.flag=true;
            break;    
        }
        this.compilation.hookAsync('compilation.parser.after',async ()=>{
            this.declarations.forEach( decl=>{
                if(decl.id.isObjectPattern){
                    decl.id.properties.forEach( decl=>{
                        if( !decl.init.useRefItems.size ){
                            decl.init.unnecessary(1183, decl.init.value());
                        }
                    })
                }else if(decl.id.isArrayPattern){
                    decl.id.elements.forEach( decl=>{
                        if( !decl.useRefItems.size ){
                            decl.unnecessary(1183, decl.value());
                        }
                    })
                }else if(!decl.useRefItems.size){
                    decl.unnecessary(1183, decl.value());
                }
            });
        });
    }
    freeze(){
        super.freeze();
        super.freeze( this.declarations );
        this.declarations.forEach( stack=>stack.freeze() );
    }
    definition(){
        return null;
    }
    reference(){
        return this.declarations[0].reference();
    }
    referenceItems(){
        return this.declarations[0].referenceItems();
    }
    value(){
        return this.declarations[0].value();
    }
    raw(){
        return this.declarations[0].raw();
    }
    warn(code,...args){
        this.declarations[0].warn(code,...args);
    }
    error(code,...args){
        this.declarations[0].error(code,...args);
    }
    parser(){ 
        if(super.parser()===false)return false
        this.declarations.forEach(item=>item.parser() );
    }

}

module.exports = VariableDeclaration;