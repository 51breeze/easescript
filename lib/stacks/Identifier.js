const JSModule = require("../core/JSModule");
const Module = require("../core/Module");
const Namespace = require("../core/Namespace");
const Stack = require("../core/Stack");
const Utils = require("../core/Utils");
const Type = require("../types/Type");
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
            if(!this.parentStack.isMemberExpression || this.parentStack.node.object === this.node){
                let desc = this.scope.define(id);
                if(desc)return;
            }

            const maybe = this.parentStack.isCallExpression || 
                            this.parentStack.isNewExpression || 
                            this.parentStack.isAssignmentPattern && this.parentStack.node.right===this.node ||
                            this.parentStack.isAssignmentExpression && this.parentStack.node.right===this.node ||
                            this.parentStack.isVariableDeclarator && this.parentStack.node.init === this.node ||
                            this.parentStack.isMemberExpression && this.parentStack.node.object === this.node ||
                            this.parentStack.isProperty && this.parentStack.node.value===this.node;
            if(maybe){
                if(this.parentStack.isMemberExpression){
                    const p = this.getParentStack(item=>!item.isMemberExpression);
                    if(p && p.isImportDeclaration){
                        return;
                    }
                }
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
                    return pStack.definition(context||this.getContext());
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
            }else if(pStack.isImportSpecifier || pStack.isImportDefaultSpecifier || pStack.isImportNamespaceSpecifier){
                return pStack.toDefinition(context);
            }else if(pStack.isExportAssignmentDeclaration || pStack.isExportDefaultDeclaration || pStack.isExportNamedDeclaration || pStack.isExportSpecifier || pStack.isExportAllDeclaration){
                return pStack.definition(context||this.getContext()); 
            }

            const pp = this.getParentStack(p=>!p.isMemberExpression);
            if(pp.isImportDeclaration){
                return pp.toDefinition(context);
            }
        }

        let desc = this.description();
        if(desc && desc.isImportDeclaration){
            return desc.definition(context);
        }

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
            
            if( Module.is(desc) ){
                return desc.definition(context);
            }else if(Type.is(desc)){
                const def = this.is(desc.target) ? desc.target.definition(context) : desc.definition( context );
                if( def )return def;
            }else if(this.is(desc)){
                const def = desc.definition(context);
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
        if(this.scope.allowInsertionPredicate()){
            const predicate = this.scope.getPredicate(desc);
            if(predicate && this.is(predicate.origin) && predicate.origin.isCallExpression){
                const ctx = predicate.origin.getContext();
                return ctx.createChild(this)
            }
        }

        

        if( desc && desc !== this && this.is(desc) && (desc.isDeclarator || desc.isProperty)){
            return desc.getContext();
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
                    if(!p.parentStack.parentStack.isExportNamedDeclaration){
                        return false;
                    }
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

            if(module && desc === module){
                return {desc, global};
            }

            if(desc && desc.parentStack && desc.parentStack.isImportDeclaration){
                const jsModule = desc.parentStack.getResolveJSModule();
                if(jsModule){
                    //if(!desc.isImportNamespaceSpecifier && this.parentStack.isCallExpression){
                        // let _desc = desc.description();
                        // while(_desc && (_desc.isImportSpecifier || _desc.isImportDefaultSpecifier) ){
                        //     _desc = _desc.description();
                        // }
                        // if(_desc){
                        //     const owner = _desc.isNamespaceDeclaration ? _desc.parentStack.module : _desc.module;
                        //     if(JSModule.is(owner)){
                        //         const result = this.parentStack.getMatchDescriptor(value, owner);
                        //         if(result){
                        //             desc = result;
                        //         }
                        //     }
                        // }
                    //}
                }else{
                    if(desc.isImportSpecifier){
                        const object = Namespace.fetch(desc.parentStack.source.value());
                        if(object){
                            const _desc = this.getMatchDescriptor(desc.imported.value(), object);
                            if(_desc)desc = _desc;
                        }
                    }
                }
            }

            if(!desc && this.compilation.hasDeclareJSModule && JSModule.is(module)){
                desc = module.namespaces.get(value);
                if(!desc && module.isNamespaceModule && module.id===value){
                    desc = module;
                }
            }

            if(desc){
                if(desc.isVariableDeclarator && desc.init === this)return false;
                if(desc.isDeclarator)return {desc, global};
            }else{
                global = !this.isJSXForContext();
                if(global){
                    if(this.parentStack.isBinaryExpression && this.parentStack.isIsOperatorFlag && this.parentStack.right === this){
                        desc = this.getModuleById(value);
                    }
                    else if(this.parentStack.isTypeAssertExpression && this.parentStack.right === this){
                        desc = this.getModuleById(value);
                    }
                    else{
                        let priorityModule = this.parentStack.isNewExpression && this.parentStack.callee === this;
                        if(priorityModule){
                            desc = this.getModuleById(value);
                        }
                        if(!desc){
                            desc = this.getMatchDescriptor(value, Namespace.dataset);
                            if(!desc && !priorityModule){
                                desc = this.getModuleById(value);
                            }
                        }
                    }
                }
            }
            
            const scopeCtx = {removed:false};
            desc = this.checkScope(desc, scopeCtx);
            
            if(!desc && module && !isAnnot && !this.parentStack.parentStack.isPropertyDefinition){
                const isRef = !this.parentStack.isMemberExpression || this.parentStack.object === this;
                if(isRef && !this.isTypeDefinitionStack(this.parentStack)){
                    const scope = this.scope.getScopeByCallback((scope)=>scope.isMethod && scope.type('function') || scope.type('class'));
                    if(scope && scope.isMethod){
                        const isStatic = !!(module.static || scope.isStatic);
                        desc = this.getMatchDescriptor(value, module, isStatic);
                    }
                }
            }
            return {desc, global, scopeCtx}
        })
    }

    descriptor(){
        return this.getAttribute('Idenfifier.descriptor', ()=>{
            let desc = this.description();
            let _desc = desc;
            while(_desc && (_desc.isImportNamespaceSpecifier || _desc.isImportSpecifier || _desc.isImportDefaultSpecifier || _desc.isImportDeclaration)){
                _desc = _desc.description();
            }
            if(_desc){
                if(this.parentStack.isCallExpression || this.parentStack.isNewExpression){
                    const object = _desc.isNamespaceDeclaration ? _desc.parentStack.module : _desc.module;
                    if(JSModule.is(object)){
                        const result = this.parentStack.getMatchDescriptor(this.value(), object);
                        if(result){
                            return result;
                        }
                    }
                }
                return _desc;
            }
            return desc;
        })
    }

    description(){
        return this.getAttribute('Idenfifier.description',()=>{
            const value = this.value();
            let isMemberExpression = false;
            if(this.parentStack.isImportDeclaration ){
                return this.parentStack.description()
            }else if(this.parentStack.isMemberExpression && this.parentStack.object===this){
                isMemberExpression = true;
                const pStack = this.getParentStack( (stack)=>!stack.isMemberExpression );
                if(pStack && pStack.isImportDeclaration){
                    return Namespace.fetch(value, null, true);
                }
            }else if(this.parentStack.isAnnotationExpression){
                const name = this.parentStack.lowerName;
                if(name==='http' || name==='router'){
                    const desc = this.parentStack.getDescriptorByStack(this);
                    if(desc){
                        return desc;
                    }
                }
            }
            let {desc,scopeCtx} = this.findDescription();
            if(desc===false)return null;
            if(!desc && isMemberExpression){
                if(this.compilation.hasDeclareJSModule){
                    let pp = this.getParentStack(stack=>stack.isModuleDeclaration);
                    if(pp.isModuleDeclaration){
                        let type = pp.module.namespaces.get(value);
                        if(type)return type;
                        const glob = JSModule.getGlobalNamespaceModule();
                        if(glob){
                            const m = glob.namespaces.get(value);
                            if(m)return m;
                        }
                    }
                }
                return Namespace.fetch(value, null, true);
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
        })
    }
    
    checkScope(desc, ctx){
        if(this.compilation.isDescriptionType)return desc;
        if(this.parentStack.isMemberExpression && this.parentStack.object !== this){
            return desc;
        }
        const _desc = desc && desc.isImportDeclaration ? desc.description() : desc;
        if( _desc && (_desc.isModule || _desc.isStack) && !this.isTypeDefinitionStack(this.parentStack) ){
            if( !this.compiler.checkContenxtDescriptor(_desc, this.module||this.compilation) ){
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
        if(description && !description.isNamespace){
            const type = description.type();
            if(type.isModule && !this.isTypeDefinitionStack(this.parentStack) ){
                this.compilation.addDependency(type, this.module);
            }
            this.parserDescriptor(type);
        }
        if( !description ){
            this.error(1013,this.value());
        }else if( (description.isAliasType || description.isGenericTypeDeclaration || description.isTypeStatement) && !this.scope.isDirective ){
            const parent = this.parentStack;
            if( !parent.isTypeTransformExpression && 
                !(this.isTypeDefinitionStack(parent) || 
                parent.isGenericTypeDeclaration || 
                parent.isBinaryExpression && parent.isIsOperatorFlag || 
                parent.isGenericDeclaration) ){
                this.error(1059,this.value());
            }
        }
    }

    type(){
        return this.getAttribute('Identifier.type',()=>{
            var type = null;
            const description = this.description();
            if(description){
                if(this.scope.allowInsertionPredicate()){
                    const predicate = this.scope.getPredicate(description);
                    if(predicate && predicate.type){
                        return predicate.type;
                    }
                }

                if(description.isImportDefaultSpecifier || description.isImportNamespaceSpecifier || description.isImportSpecifier || description.isImportDeclaration){
                   return description.type();
                }

                if(description && description.isDeclaratorVariable && (this.parentStack.isNewExpression || this.parentStack.isCallExpression)){
                    type = description.declarations[0].type();
                    const origin = Utils.getOriginType(type);
                    if(Utils.isTypeModule(origin)){
                        this.compilation.addDependency(origin, this.module);
                    }
                    return type;
                }
            }
            if( description && description.isNamespace ){
                type = description;
            }else if( description && (description.isStack || description.isType) && description !== this ){
                type = description.type();
                if(type.isGenericType && description.isStack && description instanceof Stack){
                    type = description.getContext().fetch(type, true)
                }
            }else{
                type = this.getGlobalTypeById("any");
            }
            return type;
        });
    }

    value(){
        return this.node.name;
    }

    raw(){
        return this.node.name;
    }
}

module.exports = Identifier;