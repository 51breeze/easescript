const Stack = require("../core/Stack");
const Namespace = require("../core/Namespace");
const InstanceofType = require("../types/InstanceofType");
const BlockScope = require("../scope/BlockScope");
const MergeType = require("../core/MergeType");
const Utils = require("../core/Utils");
const TupleType = require("../types/TupleType");
class JSXElement extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isJSXElement= true;
        this.jsxRootElement = parentStack.jsxRootElement || this;
        this.jsxElement = this;
        this.xmlns = [];
        this.directives = null;
        this.isSlot = false;
        this.isSlotDeclared = false;
        this.isDirective = false;
        this.isWebComponent = false;
        this.isSkinComponent = false;
        this.ownerProperty = null;
        this.newCreatedScope = false;
        this.openingElement = this.createTokenStack( compilation, node.openingElement, this.scope, node, this );
        
        if( this.hasNamespaced ){
            const nsStack = this.getNamespaceStack();
            const jsxConfig = this.compiler.options.jsx || {};
            const xmlns = this.getXmlNamespace();
            let namespace = xmlns && xmlns.value ? xmlns.value.value() : jsxConfig.xmlns.default[ nsStack.namespace.value() ];
            if( namespace === '@directives' ){
                this.scope = new BlockScope(this.scope);
                this.scope.isDirective = true;
                const dName = this.openingElement?.name?.value().toLowerCase();
                const isFor = dName==='for' || dName==='each';
                this.scope.isForContext = this.scope.parent.isForContext || isFor;
                this.scope.forContextScope = (isFor ?  this.scope : this.scope.parent.forContextScope)||null
                this.isDirective = true;
                this.syncOpeningElementScopeOf();
            }else if( namespace ==="@slots" ){
                this.scope = new BlockScope(this.scope);
                this.scope.isSlotScope = true;
                this.syncOpeningElementScopeOf();
            } 
        }
        this.children = node.children.filter( item=>{
            return !(item.type=="JSXText" && !item.value.trim());
        }).map(
            item=>this.createTokenStack( compilation, item, this.scope, node, this ) 
        );
        if( this.jsxRootElement === this ){
            this.children.sort((a,b)=>{
                return a.isJSXScript || a.isJSXStyle ? -1 : 0;
            });
            this.compilation.jsxElements.push(this);
        }
        this.closingElement = this.createTokenStack( compilation, node.closingElement, this.scope, node, this );
        this.addHook();
    }

    syncOpeningElementScopeOf(){
        this.openingElement.scope = this.scope;
        this.openingElement.attributes.forEach(attr=>{
            attr.scope=this.scope;
            attr.name.scope=this.scope;
            if(attr.value)attr.value.scope=this.scope;
        });
    }

    addHook(){
        if(!(this.hasNamespaced || this.openingElement.name.isJSXMemberExpression) || this.isSlot || this.isDirective)return;
        const id = this.getFullClassName();
        if(id && !this.hasModuleById(id)){
            this.compilation.hookAsync('compilation.create.after',async ()=>{
                await this.loadTypeAsync(id);
            });
        }else if(id && !this.scope.define(id)){
            const type = Namespace.globals.get(id);
            if(Utils.isModule(type)){
                this.compilation.addDependency(type, this.module);
            }
        }
    }

    getFullClassName(){
        return this.getAttribute('getLoadClassName',()=>{
            if( this.hasNamespaced ){
                const stack = this.getNamespaceStack()
                const ns = stack.namespace.value();
                const name = this.openingElement.value();
                const xmlns = this.getXmlNamespace(ns);
                if( xmlns ){
                    const jsxConfig = this.compiler.options.jsx || {};
                    const sections = jsxConfig.xmlns && jsxConfig.xmlns.sections;
                    const namespace = xmlns && xmlns.value ? xmlns.value.value() : jsxConfig.xmlns.default[ns];
                    if( namespace && sections[namespace]){
                        return null;
                    }
                    return namespace && namespace !=="@" ? `${namespace}.${name}` : name;
                }else{
                    return `${ns}.${name}`;
                }
            }else{
                return this.openingElement.name.value();
            }
        })
    }

    async createCompleted(){
        if( !this.compilation.JSX || !this.module )return;
        if(this.parentStack && this.parentStack.isProgram){
            const id = this.getFullClassName();
            if(id){
                const desc = await this.loadTypeAsync(id);
                if(desc && desc.isModule && desc.isClass){
                    if(!this.module.inherit && desc){
                        this.module.extends = desc;
                    }
                }
            }
            await Promise.all(this.children.filter(stack=>stack.isJSXScript).map(stack=>stack.createCompleted()));
        }
    }

    get hasNamespaced(){
        return !!this.openingElement.hasNamespaced;
    }

    get nodeName(){
        if( this.hasNamespaced ){
            const stack = this.getNamespaceStack()
            const ns = stack.namespace.value();
            const name = this.openingElement.value();
            const xmlns = this.getXmlNamespace(ns);
            if( xmlns ){
                const namespace = xmlns.value && xmlns.value.value();
                return namespace && namespace !=="@" ? `${namespace}.${name}` : name;
            }else{
                return `${ns}.${name}`;
            }
        }else{
            return this.openingElement.name.value();
        }
    }

    get attributes(){
        if( this.isAttrClone ){
            return this._attributes;
        }
        return this.openingElement.attributes.slice(0);
    }

    #_isComponent = void 0;
    get isComponent(){
        const result = this.#_isComponent;
        if(result !== void 0)return result;
        const desc = this.descriptor()
        if(this.isWebComponent){
            return this.#_isComponent = true;
        }
        if(!Utils.isModule(desc))return false;
        const VNode = Namespace.globals.get('VNode');
        return this.#_isComponent = VNode !== desc;
    }

    #_isProperty = void 0;
    get isProperty(){
        const _result = this.#_isProperty;
        if(_result !== void 0)return _result;
        let result = false;
        if( this.parentStack && this.parentStack.isJSXElement ){
            const xmlns = this.getXmlNamespace();
            if( xmlns ){
                if( this.openingElement.name.isJSXMemberExpression ){
                    result = true;
                }else if( this.openingElement.name.isJSXNamespacedName ){
                    let ns = xmlns.value && xmlns.value.value();
                    if(ns){
                        let componentClass = Namespace.fetch( ns );
                        result = this.parentStack.descriptor() === componentClass;
                    }
                }
            }
        }
        return this.#_isProperty = result;
    }

    freeze(){
        super.freeze();
        this.children.forEach( item=> item.freeze() )
    }

    definition( context ){
        if( this.isSlot ){
            if( this.isSlotDeclared ){
                return {
                    expre:`(slots) ${this.openingElement.name.value()}`,
                    location:this.openingElement.name.getLocation(),
                    file:this.file
                };
            }else{
                const declareSlot = this.getSlotDescription(this.openingElement.name.value());
                if( declareSlot ){
                    if( declareSlot.isJSXElement ){
                        return declareSlot.definition( context );
                    }else if( declareSlot.isAnnotation && declareSlot.arguments && declareSlot.arguments.length > 0){
                        const slotStack = declareSlot.arguments[0].stack;
                        if( slotStack ){
                            return {
                                expre:`(slots) ${declareSlot.name}`,
                                location:slotStack.getLocation(),
                                file:slotStack.file
                            };
                        }
                    }
                }
            }
        }
        const desc = this.descriptor();
        if( desc && desc !== Namespace.globals.get('VNode') ){
            return desc.definition( context );
        }
        return null;
    }
    reference(){
        return this;
    }
    referenceItems(){
        return [this];
    }
    isFirstUppercase( name ){
        if( name ){
           const code = name.charCodeAt(0);
           return code >= 65 && code <= 90;
        }
        return false;
    }
    description(){
        return this.getAttribute('description',()=>{
            const info = this.getElementInfo();
            let desc = null;
            if( info ){
                if(info.isDirective){
                    this.isDirective = true;
                }else if(info.isSlot){
                    this.isSlot = true;
                }else{
                    let vnode = null;
                    if( info.base ){
                        desc = this.openingElement.name.description(info.base);
                    }else if(info.desc){
                        desc = info.desc;
                    }else if(info.className){
                        vnode = Namespace.globals.get('VNode');
                        desc = this.getModuleById(info.className) || vnode;
                    }
                    if(!desc && info.base){
                        const className = info.base.isNamespace ? info.base.getChain().concat( this.openingElement.name.value() ).join('.') : this.openingElement.name.value();
                        if( this.isProperty ){
                            this.openingElement.name.error(1080, className);
                        }else{
                            this.openingElement.name.error(1111, className);
                        }
                    }
                    
                    if(desc){
                        if(desc !== vnode){
                            this.openingElement.name.setRefBeUsed(desc);
                            if(this.closingElement){
                                this.closingElement.name.setRefBeUsed(desc);
                            }
                        }
                        let type = desc.type();
                        if(Utils.isModule(type)){
                            if( this.isModuleForWebComponent(type) ){
                                this.isWebComponent = true;
                            }else if( this.isModuleForSkinComponent(type) ){
                                this.isSkinComponent = true;
                            }
                            this.compilation.addDependency(type, this.module);
                        }else if(this.is(desc) && desc.isDeclarator){
                            this.isWebComponent = true;
                        }else if(info.className){
                            const code = String(info.className).charCodeAt(0);
                            if(code >= 65 && code <= 90){
                                this.isWebComponent = true;
                            }
                        }
                    }
                }
            }
            return desc || Namespace.globals.get('any');
        })
    }

    descriptor(){
        const desc = this.description();
        if(desc){
            return desc.type()
        }
        return Namespace.globals.get('any');
    }

    getElementInfo(){
        return this.getAttribute('getElementInfo',()=>{
            if( this.hasNamespaced ){
                const xmlns = this.getXmlNamespace();
                const jsxConfig = this.compiler.options.jsx || {};
                let sections = jsxConfig.xmlns && jsxConfig.xmlns.sections;
                const nsStack = this.getNamespaceStack();
                let namespace = xmlns && xmlns.value ? xmlns.value.value() : jsxConfig.xmlns.default[nsStack.namespace.value()];
                let load = true;
                if( namespace && sections[namespace]){
                    const sects = sections[namespace];
                    const isAll = sects[0] === '*';
                    if( isAll || sects.includes( this.openingElement.name.value() ) ){
                        load = false;
                        if( namespace === '@slots' ){
                            return {isSlot:true}
                        }else if( namespace === '@directives'){
                            return {isDirective:true}
                        }
                    }else{
                        this.openingElement.name.error(1125, sects.join(',') );
                    }
                }

                if( load ){
                    const base = this.isProperty ? this.parentStack.getSubClassDescription() : Namespace.fetch(namespace, null ,true);
                    return {base}
                }else{
                    return false;
                }
            }else{
                const className = this.openingElement.name.value();
                const desc = this.scope.define(className);
                return {desc, className}
            }
        })
    }

    type(){
        return this.getAttribute('type', ()=>{
            let vnode = Namespace.globals.get('VNode');
            let isArray = false;
            if(this.isDirective){
                let name = String(this.openingElement.name.value()).toLowerCase();
                isArray = name ==='for' || name==='each';
            }else{
                isArray = this.openingElement.attributes.some( attr=>{
                    if(attr.isAttributeDirective){
                        let name = String(attr.name.value())
                        if(name ==='for' || name==='each'){
                            return true;
                        }
                    }
                    return false;
                });
            }
            if(isArray){
                return new TupleType(Namespace.globals.get('Array'), [vnode], null, false, false,true);
            }
            const desc = this.description();
            return desc ? new InstanceofType(desc.type(), this) : vnode;
        });
    }

    getNamespaceStack(){
        if( this.openingElement.name.isJSXNamespacedName ){
            return this.openingElement.name;
        }else if( this.openingElement.name.isJSXMemberExpression && this.openingElement.name.object.isJSXNamespacedName ){
            return this.openingElement.name.object;
        }
        return null;
    }

    getXmlNamespace(ns){
        ns = ns || this.hasNamespaced && this.getNamespaceStack().namespace.value();
        if( !ns )return null;
        const target = this.__xmlns || (this.__xmlns ={});
        if( target[ns] !== void 0 ){
            return target[ns];
        }
        const xmlns = this.xmlns.find( item=>{
            return item.name.name.value() === ns;
        });
        const getParent=()=>{
            const parent = this.getParentStack( parent=>!!parent.isJSXElement )
            if( parent && parent.isJSXElement ){
                return parent.getXmlNamespace( ns );
            }
            return null;
        }
        return target[ns] = xmlns || (this.parentStack.isJSXElement ? this.parentStack.getXmlNamespace( ns ) : getParent() );
    }

    getSubClassDescription(){
        const module = this.module;
        const desc = this.descriptor();
        if(module ){
            if(module.getInheritModule() === desc){
                return module;
            }
        }
        return desc;
    }

    filterPropertyChildren(){
        const children = this.children.filter( item=>{
            if( item.isJSXText ){
                return !!item.value().trim();
            }
            return !!item;
        });
        return children;
    }

    getDescriptionAcceptType(desc){
        if( desc ){
            if( desc.isMethodSetterDefinition || desc.isPropertyDefinition ){
                return desc.params[0] && desc.params[0].type();
            }else if( desc.isPropertyDefinition ){
                return desc.type();
            }
        }
        return null;
    }

    parserPropertyValue(){
        const children = this.children;
        if( children.length !== 1 || !children[0].isJSXExpressionContainer ){
            this.error(1113)
        }else{
            return children[0].descriptor();
        }
    }

    getSlotDescription(slotName, classModule){
        let parentComponent = classModule || this.parentStack && this.parentStack.descriptor();
        const define= (desc)=>{
            var stackModule = this.compilation.getStackByModule( desc );
            if( stackModule ){
                const annotation =stackModule.annotations && stackModule.annotations.find( annotation=>{
                    if( annotation.getLowerCaseName() === 'define' ){
                        const args = annotation.getArguments();
                        if( args && args.length > 1 && args[0].value && args[0].value.toLowerCase() === 'slot' ){
                            return args.slice(1).some( item=>{
                                return (item.assigned && item.key === 'name' && item.value === slotName) || (!item.assigned && item.value === slotName);
                            });
                        }
                    }
                    return false;
                });
                if( annotation ){
                    const args = annotation.getArguments();
                    const obj = {'name':slotName,args:[],isAnnotation:true,annotation,arguments:args};
                    args.slice(1).forEach( (item,index)=>{
                        const acceptType = item.stack.acceptType;
                        if(acceptType)acceptType.parser();
                        if( item.assigned ){
                            const key = item.key.toLowerCase()
                            if( key ==='scope' || key ==='props'){
                                obj.args.push({
                                    name:item.value,
                                    stack:item.stack,
                                    type:acceptType ? acceptType.type() : Namespace.globals.get('any')
                                });
                            }
                        }else if( index > 0 ){
                            obj.args.push({
                                name:item.value,
                                stack:item.stack,
                                type:acceptType ? acceptType.type() : Namespace.globals.get('any')
                            });
                        }
                    });
                    return obj;
                }
            }
        }
        while( parentComponent ){
            parentComponent = parentComponent.type();
            const pSlots = parentComponent.jsxDeclaredSlots;
            if(!(pSlots && pSlots.has( slotName ))){
                const result = define(parentComponent);
                if( result ){
                    return result;
                }
                parentComponent = parentComponent.inherit;
            }else{
               return pSlots.get( slotName );
            }
        }
        return null;
    }

    checkConditionStatementDirective(){
        const index = this.parentStack.childrenStack.indexOf( this );
        const prevStack = this.parentStack.childrenStack[ index-1 ];
        if( prevStack && prevStack.isJSXElement && prevStack.isDirective ){
            const directiveName = prevStack.openingElement.name.value().toLowerCase();
            return directiveName === 'if' || directiveName === 'elseif';
        }else if( prevStack && prevStack.openingElement.attributes.length > 0 ){
            return prevStack.openingElement.attributes.some( attr=>{
                if( attr.isAttributeDirective ){
                    const directiveName = attr.name.value().toLowerCase();
                    return directiveName === 'if' || directiveName === 'elseif';
                }
                return false;
            });
        }
        return false;
    }

    checkDirective(){
        
        const directiveName = this.openingElement.name.value().toLowerCase();
        const attrs = this.openingElement.attributes;
        if( directiveName ==='elseif' || directiveName==="else" ){
            if( !this.checkConditionStatementDirective() ){
                this.error(1156);
            }
        }

        switch( directiveName ){
            case 'if' :
            case 'show' :
            case 'elseif' :
                if( attrs.length !== 1 ){
                    this.openingElement.name.error(1145, 1, attrs.length)
                }else  if( !attrs.every( attr=>attr.name.value() === 'condition' ) ){
                    this.openingElement.name.error(1144,`condition`)
                }
                break;
            case 'else' :
                if( attrs.length > 0 ){
                    this.openingElement.name.error(1145, 0, attrs.length)
                } 
                break;
            case 'each' :
            case 'for' :{
                this.scope.isForContext = true;
                const _attrs = attrs.filter(attr=>['name','item','key','index'].includes(attr.name.value()))
                if( _attrs.length < 1 ){
                    this.openingElement.name.error(1145, 4, _attrs.length, ['*name','item','key','index'].join(', '))
                }else{
                    const resource = _attrs.find( attr=>attr.name.value() ==='name' );
                    if(!resource){
                        this.openingElement.name.error(1204, 'name')
                        return;
                    }

                    const description = resource.description();
                    const descType = description && description.type();
                    const originType = Utils.getOriginType( descType );
                    if( originType && !originType.isAnyType ){
                        if( directiveName ==="each" && !Namespace.globals.get('array').is( descType ) ){
                            resource.value.error(1119, descType.toString() );
                        }else if( originType.isNullableType || originType.isNeverType || originType.isVoidType || Namespace.globals.get('boolean').is(originType) ){
                            resource.value.error(1049,  descType.toString() );
                        }
                    }

                    const mapTypes = {
                        'item':descType ? MergeType.forOfItem( descType ) : Namespace.globals.get('any'),
                        'key':Namespace.globals.get('string'),
                        'index':Namespace.globals.get('number'),
                    }

                    this.scope.define('item', mapTypes.item);
                    _attrs.forEach( attr=>{
                        const stack = attr.description();
                        if( stack ){
                            const name = stack.value();
                            const key = attr.name.value().toLowerCase();
                            if( name && Object.prototype.hasOwnProperty.call(mapTypes, key) ){
                                (function(stack, _type){
                                    stack.isDeclarator = true;
                                    stack.kind = "let";
                                    stack.type = function type(){
                                        return _type;
                                    }
                                    stack.description = function description(){
                                        return this;
                                    }
                                    stack.definition=function definition(ctx){
                                        return {
                                            expre:`(let var) ${this.value()}:${this.type().toString(ctx|this.getContext())}`,
                                            location:this.getLocation(),
                                            file:this.compilation.file,
                                        }
                                    };
                                }(stack, mapTypes[key]));
                                this.scope.define(name, stack);
                            }
                        }
                    });
                }
                break;
            }

            case "custom" :{

                const pros = {
                    'name':Namespace.globals.get('any'),
                    'value':Namespace.globals.get('any'),
                    'modifier':Namespace.globals.get('object'),
                    'props':Namespace.globals.get('object'),
                }
                if( attrs.length < 2 || attrs.length > 3  ){
                    this.openingElement.name.error(1145,3,attrs.length);
                }else{
                    const required = {};
                    const check=(attr)=>{
                        const name = attr.name.value();
                        const type = pros[ name ];
                        required[name] = true;
                        if( type ){
                            if( attr.value ){
                                return this.checkExpressionType(type, attr.value, attr.name);
                            }else{
                                attr.name.error(1172);
                            }
                        }else{
                            //attr.name.error(1080, name);
                        }
                        return false;
                    }
                    attrs.forEach( check );
                    if( !(required.name && required.value) ){
                        this.openingElement.name.error(1173);
                    }
                }

                break;
            }
        }

    }

    getInheritModule(){
        const desc = this.descriptor();
        if( this.isComponent && this.jsxRootElement === this ){
            if( this.compilation.JSX && this.parentStack && this.parentStack.isProgram && (this.isModuleForWebComponent(desc) || this.isModuleForSkinComponent(desc)) ){
               return desc;
            }
        }
        return null;
    }

    parser(){
        if(super.parser()===false)return false;
        const jsxConfig = this.compiler.options.jsx || {xmlns:{}};
        const desc = this.descriptor();
        this.children = this.filterPropertyChildren();
        if( this.parentStack.isJSXElement ){
            this.ownerProperty = this.parentStack.ownerProperty || (this.isProperty ? this : null);
        }

        if( this.hasNamespaced ){
            const xmlns = this.getXmlNamespace() || jsxConfig.xmlns.default[ this.getNamespaceStack().namespace.value().toLowerCase() ];
            if( !xmlns ){
                this.error(1098, this.getNamespaceStack().namespace.value() );
            }
        }

        const isComponent = this.isComponent;
        const subDesc = this.getSubClassDescription();

        if( isComponent && this.jsxRootElement === this ){
            if( this.compilation.JSX && this.parentStack && this.parentStack.isProgram ){
                this.scope.define("this", new InstanceofType(this.module,this) );
                if(!(this.isSkinComponent || this.isWebComponent)){
                    this.openingElement.name.error(1179, this.openingElement.name.value() );
                }
            }else if( !this.isWebComponent ){
                this.openingElement.name.error(1134, this.openingElement.name.value() );
            }
        }

        if( this.isSlot && this.module){
            const slotName = this.openingElement.name.value();
            const pStack = this.getParentStack( stack=>!!(stack.isComponent || !stack.isJSXElement) );
            if( pStack ){
                let isDeclareSlot = !pStack.isComponent || (this.compilation.JSX && pStack.jsxRootElement === pStack);
                if( !isDeclareSlot ){
                    if( this.parentStack !== pStack ){
                        //this.openingElement.name.error(1127, slotName);
                        //父级不是组件可以当作是声明插槽
                        isDeclareSlot = true;
                    }else{
                        const pSlot = this.getSlotDescription(slotName);
                        if( !pSlot && slotName !=='default'){
                            //this.openingElement.name.warn(1126, slotName);
                            //非 default 插槽在父组件中没有定义也可以当作是声明插槽
                            isDeclareSlot = true;
                        }else if( pStack.isComponent ){
                            //isDeclareSlot = true;
                            //如果有指定参数则检查父组件中定义的插槽是否需要传参数

                            if( this.openingElement.attributes.length > 0 ){
                                const attrs = this.openingElement.attributes.filter(attr=>!attr.isAttributeDirective);
                                if(attrs.length>0){
                                    const isJsx = pSlot && pSlot.isJSXElement && pSlot.openingElement;
                                    const hasDeclareScoped = isJsx && pSlot.openingElement.attributes.some(attr=>!attr.isAttributeDirective)
                                    if(isJsx && !hasDeclareScoped){
                                        attrs.forEach( attr=>{
                                            attr.name.error(1130, attr.name.value());
                                        })
                                    }
                                }
                            }

                            let cache = pStack.getAttribute('componentsUseSlots')
                            if(!cache){
                                pStack.setAttribute('componentsUseSlots', cache={})
                            }

                            if( cache[slotName] === true ){
                                this.openingElement.name.error(1129,slotName);
                            }else{
                                cache[slotName] === true
                            }
                        }
                    }
                }

                if(isDeclareSlot){
                    const declaredSlots = this.module.jsxDeclaredSlots || (this.module.jsxDeclaredSlots=new Map());
                    this.isSlotDeclared = true;
                    if( declaredSlots.has(slotName) ){
                        this.openingElement.name.error(1129,slotName);
                    }else{
                        declaredSlots.set(slotName, this);
                    }
                    this.compilation.once('clear-cache',()=>{
                        declaredSlots.clear()
                    })
                }

            }else{
                this.openingElement.name.error(1127, slotName);
            }
        }

        const attributes = this.openingElement.attributes;
        const cacheAttrs = {};
        const isRoot = !this.isWebComponent && this.jsxRootElement === this && this.isJSXElement && this.openingElement.name.value() ==='root';
        attributes.forEach(item=>{
            item.parser();
            if(item.isJSXSpreadAttribute)return;
            const name = item.getAttributeName();
            if( cacheAttrs[name] === true ){
                item.error( 1045, name);
            }
            cacheAttrs[name] = true;
            if(isRoot && !item.isAttributeXmlns){
                item.name.error(1205);
            }

            if( !item.isAttributeXmlns && !item.isAttributeDirective && !item.isAttributeEvent && !item.isAttributeSlot){
                if( isComponent ){
                    const attrDesc = item.getAttributeDescription(subDesc);
                    if( attrDesc ){
                        item.isMemberProperty = true;
                        if( !(attrDesc.isMethodSetterDefinition || attrDesc.isPropertyDefinition) ){
                            item.name.error(1080, item.name.value() );
                        }else if( attrDesc.isPropertyDefinition && attrDesc.isReadonly){
                            item.name.error(1142, item.name.value() );
                        }else{
                            //parseAttributeStack(item, attrDesc);
                            if(item.value){
                                attrDesc.assignment(item.value,  item.name);
                            }
                        }
                    }
                }else{
                    //parseAttributeStack(item);
                }
            }else if( item.isAttributeDirective && this.isDirective ){
                item.name.error(1143);
            }
        });

        if( this.isProperty ){
            if( desc ){
                desc.assignment( this.parserPropertyValue( this.getDescriptionAcceptType(desc) ), this );
            }
        }

        if( !(isComponent || this.isProperty || this.isSlot || this.isDirective) && this.openingElement.name.isJSXMemberExpression ){
            this.warn(1108);
        }

        if( this.isDirective ){
            this.checkDirective();
        }else{
            this.directives = this.openingElement.attributes.filter( attr=>{
                return attr.isAttributeDirective;
            });
        }

        let needCheckSlotDefine = false;
        let pSlots = null;
        let hasDefaultSlot = false;
        if( this.isWebComponent && desc && !desc.isDeclaratorModule && Utils.isModule(desc)){
            if( !(desc.isSkinComponent || desc.isWebComponent) || this.jsxRootElement !== this ){
                needCheckSlotDefine = true;
                pSlots = desc.jsxDeclaredSlots;
                if(pSlots && pSlots.has('default')){
                    hasDefaultSlot = true;
                }else {
                    hasDefaultSlot = !!this.getSlotDescription('default', desc);
                }
            }
        }

        this.children.forEach((item)=> {
            item.parser();
            if( !item.isSlot && needCheckSlotDefine && !hasDefaultSlot ){
                this.openingElement.name.warn(1131, this.openingElement.name.value());
            }
        });
        
    }

    value(){
        return this.openingElement.value();
    }
}

module.exports = JSXElement;