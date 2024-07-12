const JSModule = require("../core/JSModule");
const Module = require("../core/Module");
const Namespace = require("../core/Namespace");
const Stack = require("../core/Stack");
const Utils = require("../core/Utils");
const Type = require("../types/Type");
class Identifier extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isIdentifier= true;
        this._hasMatchAutoImporter = false;
        this.addHook()
    }

    get hasMatchAutoImporter(){
        return this._hasMatchAutoImporter;
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
                return pStack.definition(context||this.getContext());
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
        if( desc && desc !== this && this.is(desc) && (desc.isDeclarator || desc.isProperty) && !desc.parentStack.isImportDeclaration){
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

            if(this.compilation.hasDeclareJSModule){
                if(!desc){
                    if(JSModule.is(module)){
                        desc = module.namespaces.get(value);
                        if(!desc && module.isNamespaceModule && module.id===value){
                            desc = module;
                        }
                    }
                }else if(this.parentStack.isMemberExpression && this.parentStack.object === this){
                    if(desc.isDeclaratorFunction || desc.isDeclaratorVariable){
                        if(JSModule.is(desc.module)){
                            const result = desc.module.namespaces.get(value);
                            if(result){
                                desc = result;
                            }
                        }
                    }
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
                            if(this.parentStack.isMemberExpression && this.parentStack.object === this){
                                desc = Namespace.dataset.children.get(value);
                                if(desc){
                                    let property = this.parentStack.property.value();
                                    if(!desc.descriptors.has(property)){
                                        desc = null;
                                    }
                                }
                            }
                            if(!desc){
                                if(Namespace.dataset.descriptors.has(value)){
                                    desc = Namespace.dataset.descriptors.get(value).find( desc=>desc.isModuleDeclaration || this.isModuleDefinitionStack(desc));
                                    if(desc){
                                        desc = desc.module;
                                    }
                                }
                                if(!desc){
                                    desc = this.getMatchDescriptor(value, Namespace.dataset);
                                }
                            }
                            if(!desc && !priorityModule){
                                desc = this.getModuleById(value);
                            }
                        }
                        if(desc && (!this.parentStack.isMemberExpression || this.parentStack.object===this)){
                            if(!this.compiler.options.service && this.compilation.isLocalDocument()){
                                if(Namespace.dataset.imports.has(value)){
                                    this.addImportSpecifierDependency(Namespace.dataset.imports.get(value), this)
                                    this._hasMatchAutoImporter = true;
                                }
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
            if(!desc)return null;
            let _desc = desc;
            if(desc.isImportDeclaration){
                if(desc.hasMatchAutoImporter){
                    this._hasMatchAutoImporter = true;
                    _desc = desc.description();
                }else{
                    return desc.description();
                }
            }

            while(_desc && (_desc.isImportNamespaceSpecifier || _desc.isImportSpecifier || _desc.isImportDefaultSpecifier)){
                _desc = _desc.description();
            }

            if(_desc.isVariableDeclarator || _desc.isDeclaratorVariable){
                const type = _desc.type();
                if(type.isFunctionType && type.target && type.target.isDeclaratorFunction){
                    _desc = type.target;
                }
            }

            if(!_desc || _desc === desc)return desc;
            let rawStack = null;
            if(this.is(_desc)){
                if(_desc.isDeclaratorTypeAlias    || 
                    _desc.isTypeStatement         ||
                    _desc.isClassDeclaration      || 
                    _desc.isDeclaratorDeclaration || 
                    _desc.isInterfaceDeclaration   ||  
                    _desc.isStructTableDeclaration || 
                    _desc.isEnumDeclaration)
                {
                    rawStack = _desc;
                    _desc = _desc.type();
                }
            }
            if(_desc){
                if(this.parentStack.isMemberExpression && this.parentStack.object === this){
                    if(_desc.isNamespaceDeclaration){
                        return _desc.module;
                    }
                    let object = rawStack ? rawStack.parentStack.module : _desc.module;
                    if(JSModule.is(object)){
                        if(desc.isImportDefaultSpecifier){
                            return object;
                        }else if(desc.isImportSpecifier){
                            return object.namespaces.get(desc.imported.value())
                        }else{
                            const maybe = object.exports.get('*');
                            if(maybe && maybe.isExportAssignmentDeclaration){
                                return maybe.getExportNamespace();
                            }
                        }
                    }
                } 
                else if(this.parentStack.isNewExpression){
                    if(JSModule.is(_desc)){
                        const maybe = _desc.exports.get('*');
                        if(maybe && maybe.isExportAssignmentDeclaration){
                            return maybe.getExportType();
                        }
                    }else if(_desc.isDeclaratorFunction || _desc.isDeclaratorVariable || _desc.isNamespaceDeclaration){
                        let object = _desc.module;
                        if(JSModule.is(object)){
                            const result = object.getType(_desc.value());
                            if(result){
                                return result;
                            }
                        }
                    }
                }else if(this.parentStack.isCallExpression){
                    let object = null;
                    if(_desc.isNamespaceDeclaration){
                        object = _desc.parentStack.module;
                    }else if(rawStack && JSModule.is(rawStack.parentStack.module)){
                        object = rawStack.parentStack.module;
                    }else if(JSModule.is(_desc)){
                        object = _desc;
                    }else if(JSModule.is(_desc.module)){
                        object = _desc.module;
                    }
                    if(object){
                        let key = this.value();
                        if(desc.isImportNamespaceSpecifier){
                            const d = object.exports.get('*');
                            if(d && d.isExportAssignmentDeclaration && d.expression.isIdentifier){
                                key = d.expression.value();
                            }else{
                                return _desc
                            }
                        }else if(desc.isImportSpecifier){
                            key = desc.imported.value();
                        }else if(desc.isImportDefaultSpecifier){
                            if(_desc.isDeclaratorFunction || _desc.isDeclaratorVariable){
                                key = _desc.value();
                            }else{
                                return _desc
                            }
                        }
                        const result = this.parentStack.getMatchDescriptor(key, object);
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
            let pStack = null;
            if(this.parentStack.isImportDeclaration ){
                return this.parentStack.description()
            }else if(this.parentStack.isMemberExpression && this.parentStack.object===this){
                isMemberExpression = true;
                pStack = this.getParentStack( (stack)=>!stack.isMemberExpression );
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
                    if(pp && pp.isModuleDeclaration && pp.module){
                        let type = pp.module.namespaces.get(value);
                        if(type)return type;
                        const glob = JSModule.getModuleFromNamespace(value);
                        if(glob){
                            return glob;
                        }
                    }
                }
                if(!this.isTypeDefinitionStack(pStack) && Namespace.top.descriptors.has(value)){
                    return this.getMatchDescriptor(value, Namespace.top);
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
        if(this.compilation.isDescriptorDocument())return desc;
        let pp = this;
        if(this.parentStack.isMemberExpression){
            if(this.parentStack.object !== this){
                return desc;
            }
            pp = this.getParentStack(stack=>!stack.isMemberExpression);
        }
        const _desc = this.is(desc) ? desc.descriptor() : desc;
        if( _desc && !this.isTypeDefinitionStack(pp.parentStack) ){
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
            let type = null;
            let description = this.description();
            if(description){
                if(description.isImportDeclaration){
                    description = description.description();
                }

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
                type = Namespace.globals.get("any");
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