const Namespace = require("../core/Namespace");
const Stack = require("../core/Stack");
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
    }

    definition( context ){
        return null;
    }

    description(){
        if( !this.parentStack.isStructTableColumnDefinition )return null;
        const key = this.key.value();
        const local = key.toLowerCase();
        if( Object.prototype.hasOwnProperty.call(mapType, local) ){
            return Namespace.globals.get(mapType[local]);
        }else{
            const desc = this.getModuleById( key );
            if( desc && desc.isModule ){
                this.compilation.addDependency(desc, this.module);
            }
            return desc ? desc : null;
        }
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
        }
    }
    
    value(){
        return this.key.value();
    }
}

module.exports = StructTableMethodDefinition;