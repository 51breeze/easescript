const Namespace = require("../core/Namespace");
const Stack = require("../core/Stack");
const LiteralObjectType = require("../types/LiteralObjectType");
class ObjectPattern extends Stack {
    constructor(compilation,node,scope,parentNode,parentStack){ 
        super(compilation,node,scope,parentNode,parentStack);
        this.isObjectPattern= true;
        this.properties = node.properties.map( item=>{
            const stack = this.createTokenStack( compilation, item, scope, node,this);
            if( stack.isProperty ){
                if( !stack.hasAssignmentPattern ){
                    const context = parentStack.parentStack.kind ==="var" ? 'function' : 'block';
                    const name = stack.init.value();
                    if(this.parentStack.isVariableDeclarator || this.parentStack.isFunctionExpression){
                        if( scope.isDefine( name , context ) ){
                            this.error(1007,name);
                        }
                        scope.define(name, stack.init);
                    }
                }
            }
            return stack;
        });
        if( node.acceptType ){
            this.acceptType = this.createTokenStack( compilation, node.acceptType, scope, node, this);
            //this.compilation.error(node.acceptType, 1151);
        }
    }
    freeze(){
        super.freeze();
        super.freeze( this.properties );
        (this.properties || []).forEach( stack=>stack.freeze() );
    }
    definition(){
        return null;
    }
    setKind(value){
        this.properties.forEach( item=>{
            item.kind=value;
        });
    }

    attribute(name,value){
        if( value !== void 0 ){
            return value;
        }
        return this.properties.find( property=>property.key.value()===name);
    }
    hasAttribute(name){
        return this.properties.some( property=>property.key.value()===name);
    }

    type(){
        if( this.acceptType ){
            return this.acceptType.type();
        }else{
            return this.getAttribute('type',()=>{
                return new LiteralObjectType(Namespace.globals.get("object"),this);
            })
        }
    }

    parser(){ 
        if(super.parser()===false)return false;
        
        if( this.acceptType ){
            this.acceptType.parser();
        }
        
        if( this.parentStack.isVariableDeclarator ){
            const init = this.parentStack.init;
            if(init){
                const type = init.type();
                const base = Namespace.globals.get("Object");
                if( base && !base.check(type) || type.isNullableType ){
                    init.error(1074, init.raw());
                }
            }else{
                this.error(1081);
            }
        }else if(this.parentStack.isFunctionExpression){
            if( this.parentStack.parentStack.isCallExpression || this.parentStack.parentStack.isNewExpression){
                const call = this.parentStack.parentStack
                const declareParams = call.isCallExpression ?call.getFunDeclareParams(call.descriptor()):call.getFunDeclareParams();
                const index = call.arguments.indexOf(this.parentStack);
                if(declareParams[index]){
                    const type = declareParams[index].type();
                    const base = Namespace.globals.get("Object");
                    if( base && !base.check(type) || type.isNullableType ){
                        this.properties.forEach(item=>item.key.error(1074, item.key.value()));
                    }
                }else{
                    this.properties.forEach(item=>item.key.error(1081, item.key.value()));
                }
            }
        }
        this.properties.forEach( item=>item.parser() );
        
    }
    value(){
        return this.properties.map( item=> {
            return item.value();
        }).join(",");
    }
}

module.exports = ObjectPattern;