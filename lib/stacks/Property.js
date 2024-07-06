const Stack = require("../core/Stack");
const AliasType = require("../types/AliasType");
const Declarator = require("./Declarator");
class Property extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isProperty= true;
        this.hasAssignmentPattern = false;
        this.assignValue = null;
        this._assignItems = new Set();
        this.isParamDeclarator = false;
        this.hasInit = node.value && node.key !== node.value;
        if( node && parentStack ){
            this.key = this.createTokenStack( compilation, node.key,scope, node,this );
            if( parentStack.isObjectPattern ){
                if( node.value.type =="Identifier" ){
                    this.init = new Declarator(compilation, node.value, scope, node, this);
                }else{
                    this.init = this.createTokenStack( compilation, node.value, scope, node,this );
                }
            }else{
                this.init = this.createTokenStack( compilation, node.value, scope, node, this );
                this.assignValue = this.init;
                this._assignItems.add(this.init);
            }

            if( this.init.isAssignmentPattern ){
                this.hasAssignmentPattern = true;
            }
            
            this._kind = node.kind;
            this.computed = !!node.computed;
            if( parentStack.isObjectPattern && parentStack && parentStack.parentStack ){
                const p = parentStack.parentStack;
                if( p.isFunctionExpression || p.isTypeFunctionDefinition ){
                    this.isParamDeclarator = true;
                }
            }
        }
    }

    get acceptType(){
        const parent = this.parentStack;
        if( parent && parent.isObjectPattern ){
            if( parent.acceptType && parent.acceptType.isTypeObjectDefinition){
                return parent.acceptType.attribute( this.value() ) || null;
            }
        }
        return null;
    }

    freeze(){
        super.freeze();
        this.key && this.key.freeze();
        this.init && this.init.freeze();
        this.acceptType && this.acceptType.freeze();
    }

    definition(ctx){
        if( this.parentStack.isObjectPattern ){
            let location = this.key.getLocation();
            let comments = this.comments
            let file = this.compilation.file;
            ctx = ctx || this.getContext();
            const type = this.type().toString(ctx);
            return {
                comments,
                location,
                file,
                expre:`(property) ${this.value()}: ${type}`,
            };
        }

        const relate = this.getRelateDescription();
        const identifier = this.value();
        const type = this.type().toString();
        let location = this.key.getLocation();
        let comments = this.comments
        let file = this.compilation.file;

        if( relate && relate.isStack){
            location = relate.key.getLocation();
            comments = relate.comments;
            file = relate.compilation.file;
        }
        
        return {
            comments,
            expre:`(property) ${identifier}: ${type}`,
            location,
            file
        };
    }

    set kind( value ){
        if( this.hasAssignmentPattern ){
            this.init.kind = value;
        }else{
            this._kind = value;
        }
    }

    get kind(){
        if( this.hasAssignmentPattern ){
            return this.init.kind;
        }else{
            return this._kind;
        }
    }

    value(){
        return this.key.value();
    }

    reference(){
        const desc = this.getObjectPatternDescription();
        if( desc ){
            return desc.reference();
        }
        if( this.hasAssignmentPattern ){
            return this.init.reference();
        }
        return this.assignValue ? this.assignValue.reference() : null;
    }

    referenceItems(){
        if( this.hasAssignmentPattern ){
            return this.init.referenceItems();
        }
        let items = [];
        this.assignItems.forEach( item=>{
            items=items.concat( item.referenceItems() );
        });
        return items;
    }

    get assignItems(){
        if( this.hasAssignmentPattern ){
            return this.init.assignItems;
        }
        return this._assignItems;
    }

    assignment(value, stack){
        if( this.parentStack.isObjectPattern ){
            this.init.assignment(value, stack);
        }else if(this.assignValue !== value){
            const first = this.assignValue;
            let acceptType = this.acceptType;
            let isNull = false;
            if( !acceptType && first ){
                const _type = first.type();
                if( _type ){
                    isNull = _type.isNullableType || _type.isVoidType;
                    if( !isNull ){
                        acceptType = _type;
                    }
                }
            }

            if( acceptType ){
                this.checkExpressionType(acceptType, value, stack);
            }

            if( !first || isNull ){
                this.assignValue = value;
            }

            this._assignItems.add( value );
            if( value && value.isStack ){
                this.setRefBeUsed( value.description() );
            }
        }
    }
   
    type(){

        const acceptType = this.acceptType;
        if( acceptType ){
            return acceptType.type();
        }

        const desc = this.getObjectPatternDescription();
        if( desc ){
            const declare = this.parentStack.parentStack;
            if( declare && declare.isVariableDeclarator && declare.init){
                const ctx = declare.init.getContext();
                return ctx.apply(desc.type());
            }else if( declare && declare.isFunctionExpression && (declare.parentStack.isCallExpression || declare.parentStack.isNewExpression)){
                const ctx = declare.parentStack.getContext();
                return ctx.apply(desc.type());
            }
            return desc.type();
        }
        
        if( this.assignValue ){
            if( this.parentStack.isObjectExpression && this.parentStack.parentStack.isVariableDeclarator){
                if( this.parentStack.parentStack === this.assignValue.description() ){
                    return new AliasType(this.parentStack.parentStack.type(), this.parentStack.parentStack.acceptType || this.parentStack.parentStack);
                } 
            }
            return this.assignValue.type();
        }

        return this.getGlobalTypeById("any");
    }

    getObjectPatternDescription(){
        if(this.parentStack.isObjectPattern){
            const argument = this.parentStack.parentStack;
            if( argument && argument.isVariableDeclarator && argument.init){
                const object = argument.init.type();
                if( object ){
                    return argument.init.getObjectDescriptor(object,this.key.value());
                }
            }else if(argument && argument.isFunctionExpression){
                const exp = argument.parentStack;
                if(exp.isCallExpression||exp.isNewExpression){
                    let declareParams = [];
                    if( exp.isCallExpression ){
                        const description = exp.descriptor()
                        declareParams = exp.getFunDeclareParams(description);
                    }else{
                        declareParams = exp.getFunDeclareParams();
                    }
                    const pos = argument.params.indexOf(this.parentStack);
                    const index = exp.arguments.indexOf(argument);
                    if(declareParams[index]){
                        const fun = declareParams[index].type();
                        if(fun.isFunctionType && fun.params[pos]){
                            const object = fun.params[pos].type();
                            return exp.getObjectDescriptor(object,this.key.value());
                        }
                    }
                }else if(exp.isAssignmentExpression){
                    const fun = exp.left.type();
                    const pos = argument.params.indexOf(this.parentStack);
                    if(fun.isFunctionType && fun.params[pos]){
                        const object = fun.params[pos].type();
                        return exp.left.getObjectDescriptor(object,this.key.value());
                    }
                }
            }else if(argument && argument.isJSXAttribute){
                const object = argument.type();
                return argument.getObjectDescriptor(object,this.key.value());
            }
        }
        return null;
    }

    getRelateDescription(){
        let parent = this.parentStack;
        let properties = [this];
        let argument = null;
        while( parent && parent.isObjectExpression ){
            argument = parent;
            parent = parent.parentStack;
            if( parent && parent.isProperty ){
                properties.push(parent)
                parent = parent.parentStack;
            }
        }
        if(parent && (parent.isCallExpression || parent.isNewExpression)){
            const index = parent.arguments.indexOf(argument);
            if( index>=0 ){
                let declareParams = [];
                if( parent.isCallExpression ){
                    const description = parent.descriptor()
                    declareParams = parent.getFunDeclareParams(description);
                }else{
                    declareParams = parent.getFunDeclareParams();
                }
                const declare = declareParams[index];
                if( declare ){
                    let desc = declare.type();
                    while(desc && properties.length>0){
                        desc = parent.getObjectDescriptorForAuxiliary(desc, properties.pop().value() );
                        if( desc && properties.length > 0 ){
                            desc = desc.type();
                        }
                    }
                    return desc;
                }
            }
        }
        return null;
    }

    description(){
        return this;
    }

    getContext(){
        if(this.parentStack.isObjectPattern){
            const declare = this.parentStack.parentStack;
            if( declare && declare.isVariableDeclarator && declare.init){
                return declare.init.getContext().createChild(this);
            }else if( this.hasAssignmentPattern ){
                return this.init.right.getContext().createChild(this);
            }else{
                return super.getContext();
            }
        }
        let init = this.init;
        if(init && init.isStack && init instanceof Stack){
            if(!(init.isFunctionExpression || init.isArrayExpression || init.isObjectExpression)){
                return init.getContext().createChild(this);
            }
        }
        return this.parentStack.getContext().createChild(this);
    }

    parser(){
        if(super.parser()===false)return false;
        
        const acceptType = this.acceptType;
        if( acceptType ){
            acceptType.parser();
            this.getContext().make(acceptType.type());
        }

        if( this.init ){
            this.init.parser();
            this.init.setRefBeUsed();
        }

        if( this.kind ==="dynamic" ){
            return true;
        }

        const name  = this.value();
        if( !this.parentStack.isObjectPattern ){
            if( this.computed ){
                const refs = this.scope.define( name );
                if( this.key.isIdentifier && !refs  ){
                    this.error(1013,name);
                }else{
                    this.setRefBeUsed( refs );
                }
            }
            return true;
        };

        if(this.parentStack.parentStack.isFunctionExpression){
            const argument = this.parentStack.parentStack;
            const exp = argument.parentStack;
            if(exp.isCallExpression||exp.isNewExpression||exp.isAssignmentExpression){
                const desc = this.getObjectPatternDescription();
                if(!desc){
                    this.error(1080, name);
                }
            }
            return true;
        }else if(this.parentStack.parentStack.isVariableDeclarator){
            //spread object or array
            const desc  =  this.scope.define( name );
            const target = this.parentStack.parentStack.init;
            if( !target )return true;
            if( target.isObjectExpression || target.isArrayExpression ){
                const init = target.attribute( name );
                if( !init ){
                    this.error(1080, name);
                }
                desc && desc.assignment( init, this.key);
            }else{
                let type = target.type();
                if( !type || type.isAnyType ){
                    return true;
                }
                if( type.isLiteralObjectType || type.isLiteralArrayType || type.isGenericType ){
                    const propertyValue = type.attribute( name );
                    if( !propertyValue ){
                        // if( !this.init.isAssignmentPattern ){
                        //     this.error(1080, name);
                        // }
                    }else{ 
                        desc && desc.assignment( propertyValue, this.key);
                    }
                }else if( type.isModule ){
                    const desc = target.getObjectDescriptor(type, name);
                    if( !desc ){
                        this.error(1080, name);
                    }
                }
            }
        }
    }

    raw(){
        if( this.hasAssignmentPattern ){
            return this.init.raw();
        }
        return super.raw();
    }

    error(code, ...args){
        this.key.error(code,...args);
    }
    warn(code, ...args){
        this.key.warn(code, ...args);
    }
}

module.exports = Property;