const Stack = require("../core/Stack");
const BlankScope = require("../scope/BlankScope");
class MetatypeDeclaration extends Stack{

    constructor(compilation,node,scope,parentNode,parentStack){
        scope = new BlankScope( null );
        super(compilation,node,scope,parentNode,parentStack);
        this.isMetatypeDeclaration= true;
        this.body = (node.body || []).map( item=>{
            return this.createTokenStack(compilation,item,scope,node,this);
        });
    }

    freeze(){
        super.freeze();
        super.freeze(this.body);
        (this.body || []).forEach( stack=>stack.freeze() )
    }

    get name(){
        return this.node.name;
    }

    description(){
        return this;
    }

    getArguments(){
        const target=[];
        this.body.map( (item,index)=>{
            if(item.isAssignmentPattern){
                const key = item.left.value();
                const value = item.right.value();
                const assigned = true;
                target.push({key,value,assigned,stack:item});
            }else{
                const key = index;
                const value = item.value();
                const assigned = false;
                target.push({key,value,assigned,stack:item});
            }
        });
        return target;
    }
}

module.exports = MetatypeDeclaration;