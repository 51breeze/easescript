const Context = require("../core/Context");
const Declarator = require("./Declarator");
class VariableDeclarator extends Declarator {
    constructor(compilation,node,scope,parentNode,parentStack){ 
        super(compilation,node,scope,parentNode,parentStack);
        this.isVariableDeclarator= true;
        this.kind = parentNode.kind;
        this.id = this.createTokenStack( compilation,node.id, scope, node, this);
        const init = this.createTokenStack( compilation, node.init, scope, node, this);
        this.dynamic = !!node.dynamic;
        this.computed = !!node.dynamic;
        this.init = init;
        this._acceptType = this.createTokenStack(compilation,node.acceptType,scope,node,this);
        if( this.dynamic && this.parentStack.isPropertyDefinition ){
            this.dynamicKeyType = this.createTokenStack(compilation,node.id.acceptType,scope,node,this); 
        }
        this.question = !!node.question;
        this.isPattern = false;
        if( parentStack && !parentStack.isDeclaratorProperty && !parentStack.parentStack.isExportNamedDeclaration){
            if( this.id.isIdentifier ){
                if( this.init ){
                    this.assignItems.add( this.init );
                    this.assignValue = this.init;
                    this.assignFirstValue = this.init;
                }
                if( !parentStack.isDeclaratorVariable && !parentStack.isPropertyDefinition ){
                    const context = this.kind ==="var" ? "function" : "block";
                    const name = this.id.value();
                    if( scope.isDefine(name , context) ){
                        this.error(1007,this.value());
                    }
                    scope.define( name, this );
                }
            }else if(this.id.isObjectPattern || this.id.isArrayPattern){
                this.isPattern = true;
                this.id.setKind(this.kind);
            }
        }
    }

    freeze(){
        super.freeze();
        this.id.freeze();
        this.acceptType && this.acceptType.freeze();
        this.init && this.init.freeze();
    }

    type(){
        const type = super.type();
        if( this.parentStack.flag && type === this.getGlobalTypeById("any") ){
            if( this.parentStack.parentStack.isForInStatement){
                return this.getGlobalTypeById("string");
            }else if( this.parentStack.parentStack.isForOfStatement ){
                return this.parentStack.parentStack.forOfType();
            }
        }
        return type;
    }

    definition(ctx){
        if(!ctx || !Context.is(ctx)){
            ctx = this.getContext();
        }

        let _type = this.type();
        if(Context.is(ctx) && this.is(ctx.stack)){
            const scope = ctx.stack.scope
            if(scope.allowInsertionPredicate()){
                const predicate = scope.getPredicate(this);
                if(predicate && predicate.type){
                    _type = predicate.type;
                }
            }
        }

        const type = _type.toString(ctx);
        const identifier = this.id.value();
        var token = this.parentStack.isPropertyDefinition ?  `${this.module.id}.${identifier}` : identifier;
        if( this.dynamic && this.parentStack.isPropertyDefinition ){
            if( this.init && this.init.isTypeDefinition ){
                token = `${this.module.id}[${identifier}:${this.acceptType.type().toString(ctx)}]`;
            }else{
                token = `${this.module.id}[${identifier}]`;
            }
        }
        const expre = this.parentStack.isPropertyDefinition ? `${this.kind||''} ${token}:${type}` :`(local ${this.kind}) ${token}:${type}`;
        return {
            comments:this.parentStack.comments,
            expre:expre,
            location:this.id.getLocation(),
            file:this.compilation.file,
        };
    }

    parser(){ 
        if(super.parser()===false)return false;
        if( this.init ){
            this.init.parser();
            if( !(this.init.isNewExpression || this.init.isCallExpression) ){
                this.init.setRefBeUsed();
            }
        }

        if(this.id.isObjectPattern || this.id.isArrayPattern){
            this.id.parser();
        }

        if( !this.dynamic ){

            if(this.module && this.module.id === this.value()){
                this.id.error(1008,this.id.value());
            }
            if( this.init ){
                if( !(this.init.isLiteral && this.init.value()===null) ){
                    const acceptType = this.acceptType;
                    if( acceptType ){
                        const atype = acceptType.type();
                        if(atype){
                            const isEmptyObject = atype.isLiteralObjectType && this.init.isObjectExpression && this.init.properties.length===0 || 
                                                atype.isLiteralArrayType && this.init.isArrayExpression && this.init.elements.length===0;
                            if( !isEmptyObject ){
                                this.checkExpressionType(acceptType, this.init, null, this.getContext());
                            }
                        }
                    }
                    const description = this.init.description();
                    if( this === description ){
                        this.error(1010,this.init.value());
                    }
                }
            }
        }else if( !this.parentStack.isPropertyDefinition ){
            this.id.parser();
        }
    }

    value(){
        return this.id.value();
    }
    raw(){
        return this.id.raw();
    }
    error(code,...args){
        this.id.error(code,...args)
    }
    warn(code,...args){
        this.id.warn(code,...args)
    }
}

module.exports = VariableDeclarator;