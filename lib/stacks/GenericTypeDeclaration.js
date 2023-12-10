const Stack = require("../core/Stack");
const GenericType = require("../types/GenericType");
class GenericTypeDeclaration extends Stack {
    constructor(compilation,node,scope,parentNode,parentStack){ 
        super(compilation,node,scope,parentNode,parentStack);
        this.isGenericTypeDeclaration= true;
        this.valueType = this.createTokenStack(compilation,node.value, scope, node, this);
        this.extends = this.createTokenStack(compilation,node.extends, scope, node, this);
    }
    freeze(){
        super.freeze(this);
        super.freeze(this.valueType);
        super.freeze(this.extends);
    }
    definition(context){
       const type = this.type();
       const identifier = this.valueType.value();
       const owner = this.parentStack.parentStack;
       let ns = owner.module ? owner.module.toString(context) : owner.isDeclaratorTypeAlias ? owner.left.value() : '';
       let desc = owner.isFunctionExpression ? owner.type().toString() : ns;
       let name = owner.isFunctionExpression && owner.parentStack && owner.parentStack.key ? ns+'.'+owner.parentStack.key.value() : '';
       return {
           kind:this.kind,
           comments:this.comments,
           identifier:identifier,
           expre:`(type parameter) ${type.toString()} in ${name}${desc}`,
           location:this.valueType.getLocation(),
           file:this.compilation.file,
           context:this
       };
    }
    error(code,...args){
        this.valueType.error(code,...args);
    }
    warn(code,...args){
        this.valueType.warn(code,...args);
    }
    description(){
        return this;
    }
    reference(){
        return this;
    }
    referenceItems(){
        return [this];
    }
    type(){
        if( !this._type ){
            if( this.extends && this.scope.define( this.extends.value() ) === this ){
                this._type = this.getGlobalTypeById('never');
            }else{
                const isFunGeneric = !!(this.parentStack && this.parentStack.parentStack && this.parentStack.parentStack.isFunctionExpression);
                this._type = new GenericType( this, null, null, isFunGeneric);
            }
        }
        return this._type;
    }

    parser(){
        if(super.parser()===false)return false;
        if( this.extends ){
            if( this.scope.define( this.extends.value() ) === this ){
                this.extends.error(1141, this.extends.value() );
            }else{
                this.extends.parser();
            }
        }
    }

    value(){
        return this.valueType.value(); 
    }
    raw(){
        return this.valueType.raw();
    }
}

module.exports = GenericTypeDeclaration;