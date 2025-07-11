const MergeType = require("../core/MergeType");
const Namespace = require("../core/Namespace");
const Stack = require("../core/Stack");
const Utils = require("../core/Utils");
const mapType={
    'tinyint':'int',
    'smallint':'int',
    'mediumint':'int',
    'int':'int',
    'bigint':'int',
    'double':'float',
    'float':'float',
    'decimal':'float',
    'numberic':'number',
    'time':'number',
    'timestamp':'string',
    'datetime':'string',
    'year':'string',
    'real':'string',
    'bit':'string',
    'char':'string',
    'varchar':'string',
    'varbinary':'string',
    'text':'string',
    'tinytext':'string',
    'mediumtext':'string',
    'longtext':'string',
    'binary':'string',
    'tinyblob':'string',
    'blob':'string',
    'mediumblob':'string',
    'longblob':'string',
    'geometry':'string',
    'point':'string',
    'linestring':'string',
    'polygon':'string',
    'multipoint':'string',
    'multilinestring':'string',
    'multipolygon':'string',
    'geometrycollectic':'string',
    'set':'string',
    'enum':'string',
}
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
                        if(desc && desc.isModule){
                            this.compilation.addDependency(desc, this.module)
                        }
                    })
                });
            }
        }else if(!Object.prototype.hasOwnProperty.call(mapType, local)){
            this.compilation.hookAsync('compilation.create.after',async ()=>{
                await this.loadTypeAsync(key);
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
            if( Object.prototype.hasOwnProperty.call(mapType, local) ){
                return Namespace.globals.get(mapType[local]);
            }else{
                const desc = Namespace.globals.get( key );
                if( desc && desc.isModule ){
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
                    let type = item.getReferenceType()
                    if(type && Utils.isModule(type)){
                        item.setRefBeUsed(type)
                    }
                }
            });
        }
    }
    
    value(){
        return this.key.value();
    }
}

module.exports = StructTableMethodDefinition;