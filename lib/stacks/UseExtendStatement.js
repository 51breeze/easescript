const Stack = require("../core/Stack");
class UseExtendStatement extends Stack{

    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isUseExtendStatement = true;
        this.isUseStatement= true;
        this.body = node.body.map( item=>this.createTokenStack( compilation,item,scope,node,this) );
        this.keywords = node.keywords.map( item=>this.createTokenStack( compilation,item,scope,node,this) );
        this.extends = node.extends.map( item=>this.createTokenStack( compilation,item,scope,node,this) );
    }

    freeze(){
        super.freeze(this);
        this.body.forEach( stack=>stack.freeze() );
        this.keywords.forEach( stack=>stack.freeze() );
        this.extends.forEach( stack=>stack.freeze() );
    }

    definition( context ){
        return null;
    }

    description(){
        return null;
    }

    async parser(){
        return await this.callParser(async ()=>{
            const methods = {};
            const dynamic = [];
            const methodItems = [];

            await this.allSettled(this.body, async item=>{
                await item.parser();
                if(item.isMethodDefinition){
                    if( item.dynamicType ){
                        dynamic.push( item );
                    }else{
                        methods[item.key.value()] = item;
                    }
                }else if(item.isPropertyDefinition){
                    if( item.dynamic ){
                        dynamic.push( item );
                    }else{
                        methods[item.key.value()] = item;
                    }
                }
                methodItems.push( item );
            });

            const _extends = []
            await this.allSettled( this.extends, async item=>{
                await item.parser();
                const modifier = item.modifier.map( item=>item.value().toLowerCase() );
                _extends.push({
                    module:item.description(),
                    mode:modifier.find( item=>item ==='prototype' || item==='class'),
                    modifier:modifier.filter( item=>!(item ==='prototype' || item==='class') )
                });
            });

            this.keywords.forEach( item=>{
                const isStatic = item.value().toLowerCase() === 'static';
                const target = isStatic ? this.module.callMethods : this.module.callMembers;
                if( isStatic ){
                    methodItems.forEach( item=>{
                        item.callableStatic = true;
                    })
                }
                target.push({
                    isUseExtendStatement:true,
                    extends:_extends,
                    callableStatic:isStatic,
                    dynamic,
                    methods:methods
                });
            });

            methodItems.forEach( item=>{
                this.module.addDescriptor( item.value(), item );
            });

        })
    }

    value(){
        return this.classType.value();
    }
}

module.exports = UseExtendStatement;