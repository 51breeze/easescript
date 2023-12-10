const Declarator = require("./Declarator");
const TupleType = require("../types/TupleType");
const MergeType = require("../core/MergeType");
const LiteralObjectType = require("../types/LiteralObjectType");
class RestElement extends Declarator{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node.argument,scope,parentNode,parentStack);
        this.isRestElement= true;
        scope.define(this.value(), this);
    }
    definition(ctx){
        const type = this.type().toString(ctx);
        const identifier = this.value();
        const context = this;
        let kind = this.parentStack.isFunctionExpression || this.parentStack.isTypeFunctionDefinition ? "(parameter)" : this.kind;
        if( this.parentStack.isObjectPattern && this.parentStack.parentStack.isVariableDeclarator ){
            kind = `(local ${kind})`
        }
        return {
            kind:kind,
            comments:context.comments,
            identifier:identifier,
            expre:`${kind} ...${identifier}:${type}`,
            location:this.getLocation(),
            file:this.compilation.file,
            context
        };
    }
    type(){
        var type = this.getAttribute('type');
        if( !type ){
            if( this.parentStack.isObjectPattern ){
                const pStack = this.parentStack.parentStack;
                type = this.getGlobalTypeById("any")
                if( pStack && pStack.isVariableDeclarator && pStack.init ){
                    const _type = pStack.init.type();
                    if( _type ){
                        const patternProperties = this.parentStack.properties.filter( item=>{
                            return !item.isRestElement;
                        });
                        if( patternProperties.length === 0 ){
                            type = _type;
                        }else{
                            if( _type.isLiteralObjectType ){
                                const properties = new Map( _type.properties );
                                patternProperties.forEach( property=>{
                                    if( property.isProperty ){
                                        properties.delete(property.key.value())
                                    }
                                });
                                type = new LiteralObjectType(_type.inherit, _type.target, properties, _type.dynamicProperties, _type.questionProperties);
                            }else if( _type.isInstanceofType ){
                                type = _type;
                            }
                        }
                    }
                }
            }else{
                type = this.acceptType ? this.acceptType.type() : this.getGlobalTypeById("any");
                if( !type.isTupleType ){
                    type = new TupleType(this.getGlobalTypeById("Array"), type, this, true);
                }else{
                    type.rest = true;
                }
            }
            this.setAttribute('type',type);
        }
        return type;
    }

    getItemType(ctx){
        var type = this.getAttribute('item-type');
        if( !type ){
            type = MergeType.forOfItem( this.type(ctx) )
            this.setAttribute('item-type', type);
        }
        return type;
    }

    parser(){
        if(super.parser()===false)return false;
        if( this.acceptType ){
            this.acceptType.parser();
            this.acceptType.setRefBeUsed();
            const type = this.acceptType.type();
            if( !type.isTupleType ){
                this.error(1071)
            }
        }  
    }
}

module.exports = RestElement;