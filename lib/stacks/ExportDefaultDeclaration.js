const Stack = require("../core/Stack");
class ExportDefaultDeclaration extends Stack {
    constructor(compilation,node,scope,parentNode,parentStack){ 
        super(compilation,node,scope,parentNode,parentStack);
        this.isExportDefaultDeclaration = true;
        this.declaration = this.createTokenStack(compilation, node.declaration, scope, node, this);
        if( parentStack && !(parentStack.isProgram || parentStack.isPackageDeclaration) ){
            this.error(1159);
        }
    }
    freeze(){
        this.declaration.freeze();
    }
    reference(){
        return this.description().reference();
    }
    referenceItems(){
        return this.description().referenceItems();
    }
    definition(){
        return this.description().definition();
    }
    description(){
        if(this.declaration.isClassDeclaration){
            return this.declaration.module;
        }
        return this.declaration.description();
    }
    value(){
        return this.declaration.value();
    }
    raw(){
        return this.declaration.raw();
    }
    type(){
        return this.description().type();
    }
    parser(){
        if(super.parser()===false)return false;
        if(this.compilation.stack.exports.length > 0 ){
            const result = this.compilation.stack.exports.filter( item=>item.isExportDefaultDeclaration );
            if( result.length > 1 ){
                this.error(1163);
            }
        }
        this.declaration.parser();
    }
}

module.exports = ExportDefaultDeclaration;