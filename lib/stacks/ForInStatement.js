const Stack = require("../core/Stack");
const BlockScope = require("../scope/BlockScope");
class ForInStatement extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        scope = new BlockScope(scope);
        super(compilation,node,scope,parentNode,parentStack);
        this.isForInStatement= true;
        this.left  = this.createTokenStack(compilation,node.left,scope,node,this);
        this.right = this.createTokenStack(compilation,node.right,scope,node,this);
        this.body  = this.createTokenStack(compilation,node.body,scope,node,this);
    }
    freeze(){
        super.freeze();
        this.left.freeze();
        this.right.freeze();
        this.body.freeze();
    }
    definition(){
        return null;
    }
    parser(){
        if(super.parser()===false)return false;
        this.left.parser();
        this.left.setRefBeUsed();
        this.right.parser();
        this.right.setRefBeUsed();
        if( this.body){
            this.body.parser();
        }
        const desc = this.right.description();
        const type = desc.type();
        const iterator = this.getGlobalTypeById("Iterator");
        const objectType = this.getGlobalTypeById("Object");
        if( !type.isAnyType ){
            if( iterator.check(type) || objectType.check(type) )return;
            this.right.error(1046,this.right.raw());
        }
        if( this.left.isVariableDeclaration ){
            if( this.left.declarations.length > 1 ){
                this.left.declarations[1].error(1047,'for-in');
            }
            if( this.left.declarations[0].init ){
                this.left.declarations[0].init.error(1048,'for-in');
            }
        }
        const checkItems = new Set();
        const getCheckItems = (desc)=>{
            if( !desc )return [];
            let items = [];
            if( desc.isDeclarator || desc.isPropertyDefinition){
                if( desc.acceptType && !desc.acceptType.type().isAnyType ){
                    checkItems.add( desc.acceptType.type() )
                }else{
                    items = Array.from(desc.assignItems);
                }
            }else if( desc.isMethodDefinition || desc.isFunctionDeclaration ){
                if( desc.returnType && !desc.returnType.type().isAnyType ){
                    checkItems.add( desc.returnType.type() )
                }else{
                    items = desc.scope.returnItems.map( item=>item.argument );
                    if( desc.isMethodGetterDefinition ){
                        const name = desc.key.value()
                        const setter = this.module.getMember(name , "set");
                        if( setter ){
                            items = items.concat( Array.from(setter.assignItems) );
                        }
                    }
                }
            }else{
                items.push( desc );
            }
            items.forEach( item=>{
                if(item.isArrayExpression || item.isLiteral || item.isObjectExpression || item.isModule){
                    if( item.isModule ){
                        checkItems.add( item );
                    }else{
                        checkItems.add( item.type() );
                    }
                }else if( item.isStack ){
                    const desc = item.description();
                    if( item !== desc){
                        getCheckItems( desc );
                    }
                }
            });
        }
        getCheckItems( desc );
        const result =  Array.from(checkItems).every( type=>{
            return type.is( iterator ) || type.is(objectType);
        });
        if( !result ){
            this.right.warn(1049,this.right.raw());
        }
    }
}

module.exports = ForInStatement;