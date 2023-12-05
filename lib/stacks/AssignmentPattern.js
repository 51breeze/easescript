const Declarator = require("./Declarator");
class AssignmentPattern extends Declarator{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isAssignmentPattern=true;
        this.left = this.createTokenStack( compilation, node.left, scope, node ,this);
        this.right = this.createTokenStack( compilation, node.right, scope, node ,this);
        if( !(parentStack && (parentStack.isArrayPattern || parentStack.isProperty) ) ){
            this._acceptType = this.createTokenStack( compilation, node.left.acceptType, scope, node ,this);
        }
        
        // if( this.isParamDeclarator && node.left.question ){
        //     this.left.error(1016);
        // }

        const isAssignment = this.parentStack.isArrayPattern && this.parentStack.parentStack.isAssignmentExpression;
        if( !(isAssignment || this.parentStack.isAnnotationDeclaration || this.parentStack.isAnnotationExpression) ){
            const stack = this.getParentStack( stack=>!!(stack.isVariableDeclaration || stack.isBlockStatement) );
            const name = this.left.value();
            let context = void 0;
            if( stack && stack.isVariableDeclaration ){
                context = stack.kind ==="var" ? 'function' : 'block';
            }
            if( scope.isDefine( name , context ) ){
                this.error(1007,name); 
            }
            scope.define(name, this);
            this.assignValue = this.right;
            this.assignFirstValue = this.right;
            this.assignItems.add( this.right );
        }
    }
    freeze(){
        super.freeze();
        this.left.freeze();
        this.right.freeze();
    }
    type(){
        if( this.parentStack && this.parentStack.isAnnotationDeclaration && this.parentStack.name.toLowerCase() === 'embed' ) {
            const item = this.parentStack.getArguments()[0];
            if( item.assigned && /\.(css|less|scss|sass)$/i.test( item.value ) ){
                return this.getGlobalTypeById('object');
            }
        }

        if( this.acceptType  ){
            return this.acceptType.type();
        }
        if( this.inheritInterfaceAcceptType ){
            return this.inheritInterfaceAcceptType.type();
        }

        if( this.parentStack.isTryStatement ){
            return this.getGlobalTypeById('Error');
        }

        const desc = this.description();
        if( desc && desc !== this ){
            return this.getContext().apply( desc.type() );
        }
        
        return super.type();
    }

    description(){
        const p = this.parentStack;
        var desc = null;
        if(p.isProperty && p.parentStack.isObjectPattern && p.parentStack.parentStack.isVariableDeclarator){
            const init = p.parentStack.parentStack.init;
            if( init ){
                const type = init.type();
                const isStatic = (type.isClassGenericType && type.isClassType) || p.parentStack.parentStack.init.description() === type;
                desc = this.getObjectDescriptor(init.type(), this.left.value(), isStatic);
                if( desc && (desc.isAnyType || desc.isGenericType || desc.isNullableType || desc.isNeverType) ){
                    desc = null;
                }
            }
        }else if(p.isArrayPattern && p.parentStack.isAssignmentExpression ){
            return this.left.description();
        }
        if( desc ){
            return desc;
        }
        return super.description();
    }

    definition(context){
        const type = this.type().toString();
        const identifier = this.value();
        if( this.parentStack.isFunctionExpression ){
            return super.definition( context );
        }
        if( this.parentStack.isAnnotationDeclaration || this.parentStack.isAnnotationExpression ){
            return this.parentStack.definition( context );
        }else if( this.isParamDeclarator ){
            return super.definition( context );
        }else if( this.parentStack.isProperty ){
            return this.parentStack.definition( context );
        }
        return {
            kind:this.kind,
            identifier:identifier,
            expre:`${this.kind} ${identifier}:${type}`,
            location:this.left.getLocation(),
            file:this.compilation.file,
            context:this
        };
    }
    value(){
        return this.left.value();
    }

    error(code,...args){
        this.left.error(code,...args);
    }

    warn(code,...args){
        this.left.warn(code,...args);
    }

    async parser(){
        return await this.callParser(async ()=>{
            if( this.acceptType ){
                this.acceptType.parser()
            }
            await this.right.parser();
            if( this.module && this.module.id === this.left.value() ){
                this.left.error(1008, this.left.value() );
            }
            const isStatement = this.parentStack.isFunctionExpression;
            const isNullable = isStatement && this.right.isLiteral && this.right.value()===null;
            if( !isNullable  ){
                this.checkExpressionType( this.acceptType, this.right );
            }
            const lDesc = this.left.description();
            const rDesc = this.right.description();
            if( lDesc === rDesc ){
                this.error(1010,this.right.value());
            }
        })
    }
}

module.exports = AssignmentPattern;