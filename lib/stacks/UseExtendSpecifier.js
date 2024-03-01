const Namespace = require("../core/Namespace");
const Stack = require("../core/Stack");
class UseExtendSpecifier extends Stack{

    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isUseExtendSpecifier= true;
        this.id = this.createTokenStack( compilation,node.id,scope,node,this);
        this.modifier = node.modifier.map( item=>this.createTokenStack( compilation,item,scope,node,this) );
        this.genericity=null;
        if( node.genericity ){
            this.genericity = node.genericity.map(item=>this.createTokenStack(compilation,item,scope,node,this));
        }

        const id = this.id.value();
        if(id && !this.scope.isDefine(id) && !this.hasModuleById(id)){
            if( this.compilation.hasManifestResource(id, Namespace.dataset) ){
                this.compilation.hookAsync('compilation.create.after',async ()=>{
                    await this.loadTypeAsync(id);
                });
            }
        }
    }

    freeze(){
        super.freeze(this);
        super.freeze(this.id);
        (this.genericity || []).forEach( stack=>stack.freeze() );
        this.modifier.forEach( stack=>stack.freeze() );
    }

    definition( context ){
        return null;
    }

    description(){
        return this.getModuleById( this.id.value() );
    }

    value(){
        return this.id.value();
    }

    parser(){
        if(super.parser()===false)return false;
        const classType = this.getModuleById(this.id.value());
        if( classType ){
            this.parserDescriptor(classType);
            const assignments = this.genericity
            if( assignments && assignments.length > 0 ){
                this.parentStack.parentStack.genericsCheck(classType, assignments, this.id);
            }
        }else{
            this.error(1026, this.id.value() );
        }
    }
}

module.exports = UseExtendSpecifier;