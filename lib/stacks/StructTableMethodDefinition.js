const MergeType = require("../core/MergeType");
const Namespace = require("../core/Namespace");
const Stack = require("../core/Stack");
const Utils = require("../core/Utils");
class StructTableMethodDefinition extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isStructTableMethodDefinition = true;
        this.key = this.createTokenStack(compilation,node.key,scope,node,this);
        this.params = node.params.map( item=> this.createTokenStack(compilation,item,scope,node,this) );
        this.addHook();
    }

    addHook(){
        const key = this.key.value();
        const local = key && key.toLowerCase();
        if(local ==='enum'){
            const items = this.params.filter( item=>{
                if(item.isIdentifier||item.isMemberExpression){
                    const id = item.value();
                    return !Utils.isGlobalTypeName(id) && this.checkNeedToLoadTypeById(id)
                }
                return false;
            });
            if(items.length>0){
                this.compilation.hookAsync('compilation.create.after',async ()=>{
                    await this.compiler.callAsyncSequence(items, async(item)=>{
                        const desc = await this.loadTypeAsync(item.value());
                        if(Utils.isModule(desc)){
                            this.compilation.addDependency(desc, this.module)
                        }
                    })
                });
            }
        }else if(!Utils.getStructTableMethodTypeName(local)){
            this.compilation.hookAsync('compilation.create.after',async ()=>{
                const desc = await this.loadTypeAsync(key);
                if(Utils.isModule(desc)){
                    this.compilation.addDependency(desc, this.module)
                }
            });
        }
    }

    definition( context ){
        return null;
    }

    description(){
        if(!this.parentStack.isStructTableColumnDefinition)return null;
        return this.getAttribute('description',()=>{
            const key = this.key.value();
            const local = key.toLowerCase();
            if(local==='enum'){
                const mergeType = new MergeType()
                this.params.forEach( item=>{
                    if(item.isIdentifier||item.isMemberExpression){
                        let type = item.getReferenceType()
                        if(type){
                            if(!(type.isModule && type.isEnum)){
                                item.error(1009, type.toString(), 'Enum')
                            }else{
                                mergeType.add(type)
                            }
                        }else{
                            item.error(1175, item.value())
                        }
                    }else if(item.isLiteral){
                        mergeType.add(item.type(), true)
                    }
                });
                return mergeType.type()
            }
            const name = Utils.getStructTableMethodTypeName(local)
            if(name){
                return Namespace.globals.get(name);
            }else{
                const desc = this.key.getReferenceType();
                if(Utils.isModule(desc)){
                    this.compilation.addDependency(desc, this.module);
                }
                return desc ? desc : null;
            }
        })
    }

    type(){
        const desc = this.description();
        if(!desc)return Namespace.globals.get('string');
        return desc.type();
    }

    parser(){
        if(super.parser()===false)return false;
        if( this.parentStack.isStructTableKeyDefinition ){
            if( this.params.length > 0 ){
                this.params.forEach( item=>{
                    if( !this.module.hasMember( item.value() ) ){
                        item.error(1166, item.value());
                    }
                });
            }else{
                this.key.error(1167);
            }
        }else if(this.parentStack.isStructTableColumnDefinition){
            this.params.forEach( item=>{
                if(item.isIdentifier||item.isMemberExpression){
                    item.setRefBeUsed()
                }
            });
            if(!Utils.getStructTableMethodTypeName(this.key.value())){
                this.key.setRefBeUsed()
            }
        }
    }
    
    value(){
        return this.key.value();
    }
}

module.exports = StructTableMethodDefinition;