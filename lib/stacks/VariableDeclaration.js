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
    async parser(){ 
        return await this.callParser(async ()=>{
            await this.allSettled(this.declarations, async item=>await item.parser() );
        })
    }

}

module.exports = VariableDeclaration;