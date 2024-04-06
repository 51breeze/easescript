const Declarator = require("./Declarator");
const TupleType = require("../types/TupleType");
const MergeType = require("../core/MergeType");
const LiteralObjectType = require("../types/LiteralObjectType");
const Namespace = require("../core/Namespace");
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
        return this.getAttribute('type',()=>{
            let type = Namespace.globals.get('any')
            if( this.parentStack.isObjectPattern ){
                const pStack = this.parentStack.parentStack;
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
                type = this.acceptType ? this.acceptType.type() : type;
                if( !type.isTupleType ){
                    type = new TupleType(Namespace.globals.get('Array'), type, this, true);
                }else{
                    type.rest = true;
                }
            }
            return type;
        })
    }

    getItemType(){
        return this.getAttribute('item-type', ()=>{
            return MergeType.forOfItem( this.type() )
        });
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