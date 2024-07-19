const Stack = require("../core/Stack");
const GenericType = require("../types/GenericType");
class GenericTypeAssignmentDeclaration extends Stack {
    constructor(compilation,node,scope,parentNode,parentStack){ 
        super(compilation,node,scope,parentNode,parentStack);
        this.isGenericTypeAssignmentDeclaration= true;
        this.left = this.createTokenStack(compilation,node.left, scope, node, this);
        this.extends = this.createTokenStack(compilation,node.extends, scope, node, this);
        this.right = this.createTokenStack(compilation,node.right, scope, node, this);
    }
    freeze(){
        super.freeze(this);
        super.freeze(this.left);
        super.freeze(this.extends);
        super.freeze(this.right);
    }
    definition(){
       const type = this.type();
       if( type.isModule ){
           return type.definition();
       }
       const identifier = this.left.value();
       return {
           kind:this.kind,
           comments:this.comments,
           identifier:identifier,
           expre:`(Type) ${type.toString()}`,
           location:this.left.getLocation(),
           file:this.compilation.file,
           context:this
       };
    }
    error(code,...args){
        this.left.error(code,...args);
    }
    warn(code,...args){
        this.left.warn(code,...args);
    }
    description(){
        return this;
    }
    referenceItems(){
        return [this];
    }

    type(){
        if( !this._type ){
            const isFunGeneric = !!(this.parentStack && this.parentStack.parentStack && this.parentStack.parentStack.isFunctionExpression);
            this._type = new GenericType( this, null, this.right.type(), isFunGeneric);
        }
        return this._type;
    }

    parser(){
        if(!super.parser())return false;
        this.right.parser();
        if( this.extends ){
            if( this.scope.define( this.extends.value() ) === this ){
                this.extends.error(1141, this.extends.value() );
            }else{
                this.extends.parser();
            }
        }
    }

    value(){
        return this.left.value();
    }
}

module.exports = GenericTypeAssignmentDeclaration;