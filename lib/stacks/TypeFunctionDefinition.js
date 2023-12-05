const Stack = require("../core/Stack");
const FunctionType = require("../types/FunctionType");
const FunctionScope = require("../scope/FunctionScope");
const Declarator = require("./Declarator");
const keySymbol = Symbol("key");
class TypeFunctionDefinition extends Stack {
    constructor(compilation,node,scope,parentNode,parentStack){ 
        super(compilation,node,scope,parentNode,parentStack);
        this.scope = scope = new FunctionScope( scope );
        this.isTypeFunctionDefinition= true;
        this._returnType = this.createTokenStack(compilation,node.value, scope, node, this);
        let assignment = null;
        let hasRest = null;
        this.params = node.params.map( item=>{
            if( item.type =="Identifier" ){
                const stack = new Declarator(compilation,item,scope,node,this);
                if( assignment ){
                    assignment.error(1050,assignment.value()); 
                }
                scope.define(stack.value(), stack);
                return stack;
            }else{
                const stack = this.createTokenStack(compilation,item,scope,node,this);
                if( stack.isRestElement ){
                    hasRest = stack;
                }
                assignment = stack;
                return stack;
            }
        });
        if( hasRest && this.params[ this.params.length-1 ] !== hasRest ){
            hasRest.error(1051,hasRest.value());
        }
        this[keySymbol]={};
    }
    freeze(){
        super.freeze();
        super.freeze( this.params );
        this.returnType && this.returnType.freeze();
        this.params.forEach( stack=>stack.freeze() );
    }
    definition( ctx ){
        ctx = ctx || this.getContext();
        return this.type().definition(ctx);
     }
    description(){
        return this;
    }
    referenceItems(){
        return [this];
    }
    type(){
        return this.getFunType();
    }
    setRefBeUsed(){}
    
    get returnType(){
        return this.getAttribute('returnType', ()=>{
            return this._returnType ? this.normalization( this._returnType.type() ) : this.getGlobalTypeById("void");
        })
    }

    normalization( type ){
        if( type && type.isUnionType ){
            if( type.elements.some( type=>type.type().isAnyType ) ){
                return this.getGlobalTypeById("any");
            }
            const elements = type.elements.filter( type=>!type.type().isNullableType );
            if( elements.length === 1 ){
                return type.elements[0].type();
            }else if( !elements.length ){
                return type.elements[0]
            }
            if( elements.length !== type.elements.length ){
                return new UnionType(elements, type.target )
            }
        }
        return type;
    }


    getReturnedType(){
        return this.returnType
    }

    getFunType(){
        return this.getAttribute('getFunType', ()=>{
            return new FunctionType(this.getGlobalTypeById("Function"), this);
        });
    }
    async parser(){
        return await this.callParser(async ()=>{
            await this.allSettled(this.params, async item=>await item.parser() );
            if( this._returnType ){
                await this._returnType.parser();
                if( !this._returnType.type() ){
                    this._returnType.error(1083, this._returnType.value());
                }
            }
        })
    }
}

module.exports = TypeFunctionDefinition;