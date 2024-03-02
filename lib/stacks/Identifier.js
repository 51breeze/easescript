const Namespace = require("../core/Namespace");
const Stack = require("../core/Stack");
const keySymbol = Symbol("key");
class Identifier extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isIdentifier= true;
        this[keySymbol]={};
        this.addHook()
    }

    addHook(){
        if(!this.isJSXForContext()){
            const id = this.value();
            const maybe = this.parentStack.isCallExpression || 
                            this.parentStack.isNewExpression || 
                            this.parentStack.isAssignmentPattern && this.parentStack.node.right===this.node ||
                            this.parentStack.isAssignmentExpression && this.parentStack.node.right===this.node ||
                            this.parentStack.isVariableDeclarator && this.parentStack.node.init === this.node ||
                            this.parentStack.isMemberExpression && this.parentStack.node.object === this.node ||
                            this.parentStack.isProperty && this.parentStack.node.value===this.node;
            if(maybe){
                if(this.checkNeedToLoadTypeById(id)){
                    this.compilation.hookAsync('compilation.create.after',async ()=>{
                        const desc = await this.loadTypeAsync(id);
                        if(desc && desc.isModule){
                            this.compilation.addDependency(desc, this.module)
                        }
                    });
                }else{
                    const desc = this.scope.define(id);
                    if(desc && desc.isModule){
                        this.compilation.addDependency(desc, this.module)
                    }
                }
            }
        }
    }

    definition(context){
       
        const pStack = this.parentStack;
        if( pStack ){
            if( this.isTypeDefinitionStack(pStack) ){
                //const inWrap = pStack.parentStack.isTypeGenericDefinition && pStack.parentStack.elements.includes(pStack);
                //if( !inWrap ){
                    return pStack.definition(context);
                //}
            }
            if(pStack.isMethodDefinition || pStack.isFunctionDeclaration || pStack.isProperty){
                if(pStack.key === this){
                    return pStack.definition(context);
                }else if( pStack.isProperty && pStack.parentStack.isObjectPattern &&  pStack.init === this){
                    return pStack.definition(context);
                }
            }else if(pStack.isVariableDeclarator){
                if( pStack.parentStack.isDeclaratorVariable ){
                    return pStack.parentStack.definition(context);
                }else if(pStack.id === this){
                    return pStack.definition(context);
                }
            }else if( pStack.isClassDeclaration || pStack.isDeclaratorDeclaration || pStack.isInterfaceDeclaration || (pStack.isEnumDeclaration && !pStack.isExpressionDeclare) ){
                if(!context){
                    context = pStack.getContext()
                }
            }else if( pStack.isDeclaratorTypeAlias || pStack.isDeclaratorVariable || pStack.isDeclaratorFunction){
                return pStack.definition(context);
            }else if(pStack.isAnnotationExpression){
                const name = pStack.name.toLowerCase();
                if( name ==='http' || name ==='router' ){
                    const index = pStack.body.indexOf(this);
                    if( index >= 0 ){
                        const args = pStack.getArguments();
                        const itemArg = args[index];
                        if(  index < 2 || itemArg && String(itemArg.key).toLowerCase()==='action' ){
                            return pStack.definition( context || super.getContext() );
                        }
                    }
                }
            }
        }

        const desc = this.description();
        if( this.value() === "arguments" ){
            const expre = `(local const) arguments: ${desc.type().toString()}`;
            return {
                expre:expre,
            };
        }

        context = context || this.getContext();
        if( desc && desc !== this ){
            const pStack = this.parentStack;
            if( (pStack.isCallExpression ||  pStack.isNewExpression ) && pStack.callee === this){
                return pStack.definition( context );
            }else if( pStack.isMemberExpression  ){
                if( pStack.parentStack.isImportDeclaration || pStack.property === this ){
                    return pStack.definition( context );
                }
            }else if( pStack.isTypeObjectPropertyDefinition || pStack.isTypeTupleRestDefinition ){
                return this.parentStack.definition( context )
            }
            if( desc.isModule ){
                return desc.definition( context );
            }else if( desc.isType && !desc.isStack ){
                const def = desc.target && desc.target.isStack ? desc.target.definition(context) : desc.definition( context );
                if( def )return def;
            }else if( desc.isStack ){
                const def = desc.definition( context );
                if( def )return def;
            }
        }
        if(this.parentStack){
            if( this.parentStack.isStructTableDeclaration || this.parentStack.isAssignmentExpression ){
                return null;
            }
            return this.parentStack.definition( context )
        }
        return null;
    }

    reference(called){
        const value = this.value();
        const description = this.scope.define( value );
        if(description && description !== this && description instanceof Stack ){
            return description.reference(called);
        }
        return this;
    }

    referenceItems(called){
        const value = this.value();
        const description = this.scope.define( value );
        if(description && description !== this && description instanceof Stack ){
            return description.referenceItems(called);
        }
        return [this];
    }

    getContext(){
        const desc = this.description();
        if( desc && desc !== this && desc.isStack && (desc.isDeclarator || desc.isProperty) ){
            return this.getAttribute('Idenfifier.getContext',()=>{
                return desc.getContext().createChild(this);
            });
        }
        return super.getContext();
    }

    findDescription(){
        return this.getAttribute('Idenfifier.findDescription.result',()=>{
            if(this.parentStack.isMemberExpression && !this.parentStack.computed && this.parentStack.object !== this){
                return false
            }
            const value = this.value();
            const module = this.module;
            let isAnnot = false;
            let p = this.parentStack;
            if( p ){
                if( p.isVariableDeclarator && p.id === this ){
                    return false;
                }
                if( p.isAssignmentPattern && p.left === this && !(p.parentStack.isArrayPattern && p.parentStack.parentStack.isAssignmentExpression)){
                    return false;
                }
                if( p.isProperty && p.key === this && p.hasInit ){
                    return false;
                }
                p = p.parentStack;
                isAnnot = p.isAnnotationDeclaration || p.isAnnotationExpression;
            }

            var desc = this.scope.define( value );
            var global = false;

            if(desc && desc.isImportSpecifier && desc.parentStack && desc.parentStack.isImportDeclaration){
                const object = Namespace.fetch(desc.parentStack.source.value());
                if(object){
                    const _desc = this.getMatchDescriptor(desc.imported.value(), object);
                    if(_desc)desc = _desc;
                }
            }

            if(desc){
                if(desc.isVariableDeclarator && desc.init === this)return false;
                if(desc.isDeclarator)return {desc, global};
                if(desc.isModule && desc.id === value)return {desc, global};
            }else{
                if(module && value === module.id){
                    return {desc:module, global}
                }else {
                    global = !this.isJSXForContext();
                    if(global){
                        if( (this.parentStack.isCallExpression || this.parentStack.isNewExpression) && this.parentStack.callee === this ){
                            desc = this.getMatchDescriptor(value, Namespace.dataset);
                        }
                        // else{
                        //     desc = Namespace.fetch(value);
                        //     if(desc && desc.isAliasType )desc = null;
                        // }
                    }
                }
            }

            const scopeCtx = {removed:false};
            desc = this.checkScope(desc, scopeCtx);
            
            if(!desc && module && !isAnnot ){
                const scope = this.scope.getScopeByType('function');
                const isRef = !this.parentStack.isMemberExpression || this.parentStack.object === this;
                if( isRef && !this.parentStack.isTypeDefinition ){
                    const isStatic = !!(module.static || (scope && scope.isMethod ? scope.isStatic : false));
                    desc = this.getMatchDescriptor(value, module, isStatic);
                }
            }
            return {desc, global, scopeCtx}
        })
    }

    description(){
        const result = this[keySymbol].description;
        if(result){
            return result[0];
        }
        const value = this.value();
        if(this.parentStack.isImportDeclaration ){
            return this.getModuleById(value);
        }else if(this.parentStack.isMemberExpression && this.parentStack.object===this){
            const pStack = this.getParentStack( (stack)=>!stack.isMemberExpression );
            if(pStack && pStack.isImportDeclaration){
                return Namespace.fetch(this.value(), null, true);
            }
        }
        let {desc,scopeCtx,global} = this.findDescription();
        if(desc===false)return null;
        if(!desc && global){
            desc = this.getModuleById(value);
        }
        if(scopeCtx && desc){
            desc = this.checkScope(desc, scopeCtx);
        }
        if(!desc && scopeCtx && scopeCtx.removed ){
            this.error(1178,this.raw());
        }
        if(desc && desc.isDeclaratorVariable && desc.init === this){
            return null
        }else if( desc === this ){
            return null
        }
        return desc;
    }

    checkScope(desc, ctx){
        if(this.compilation.isDescriptionType)return desc;
        if(this.parentStack.isMemberExpression && this.parentStack.object !== this){
            return desc;
        }
        if( desc && (desc.isModule || desc.isStack) && !this.isTypeDefinitionStack(this.parentStack) ){
            if( !this.compiler.checkContenxtDescriptor(desc, this.module||this.compilation) ){
                ctx.removed = true;
                return null;
            }
        }
        return desc;
    }

    parser(){
        if(super.parser()===false)return false;
        if( this.isJSXForContext() ){
            return true;
        }
        const description = this.description();
        this[keySymbol].description = [description];

        if(description){
            if(description.isModule && !this.isTypeDefinitionStack(this.parentStack) ){
                this.compilation.addDependency(description, this.module);
            }
            this.parserDescriptor(description);
        }

        if( !description ){
            this.error(1013,this.value());
        }else if( (description.isAliasType || description.isGenericTypeDeclaration || description.isTypeStatement) && !this.scope.isDirective ){
            const parent = this.parentStack;
            if( !parent.isTypeTransformExpression && 
                !(this.isTypeDefinitionStack(parent) || 
                parent.isGenericTypeDeclaration || 
                parent.isGenericDeclaration) ){
                this.error(1059,this.value());
            }
        }
    }

    type(){
        var type = null;
        const description = this.description();
        if( description && description.isNamespace ){
            type = description;
        }else if( description && (description.isStack || description.isType) && description !== this ){
            type = description.type();
        }else{
            type = this.getGlobalTypeById("any");
        }
        return type;
    }

    value(){
        return this.node.name;
    }

    raw(){
        return this.node.name;
    }
}

module.exports = Identifier;