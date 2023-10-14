const Stack = require("../core/Stack");
const Namespace = require("../core/Namespace");
const InstanceofType = require("../types/InstanceofType");
const BlockScope = require("../scope/BlockScope");
const MergeType = require("../core/MergeType");
const Utils = require("../core/Utils");
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
                this.scope.isForContext = true;
                this.isDirective = true;
            }else if( namespace ==="@slots" ){
                this.scope = new BlockScope(this.scope);
                this.scope.isSlotScope = true;
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
        }
        this.closingElement = this.createTokenStack( compilation, node.closingElement, this.scope, node, this );
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

    get isComponent(){
        const desc = this.description();
        return !!(desc && desc.type().isModule && this.getGlobalTypeById('VNode') !== desc);
    }

    get isProperty(){
        if( this.parentStack && this.parentStack.isJSXElement ){
            const xmlns = this.getXmlNamespace();
            if( xmlns ){
                if( this.openingElement.name.isJSXMemberExpression ){
                    return true;
                }else if( this.openingElement.name.isJSXNamespacedName ){
                    let ns = xmlns.value && xmlns.value.value();
                    let componentClass = Namespace.fetch( ns );
                    return this.parentStack.description() === componentClass;
                }
            }
        }
        return false;
    }

    freeze(){
        super.freeze();
        this.children.forEach( item=> item.freeze() )
    }

    definition( context ){
        const stack =context && context.stack;
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

        if( stack ){
            if( this.hasNamespaced ){
                const xmlns = this.getXmlNamespace();
                const namespace = xmlns && xmlns.value && xmlns.value.value();
                const space = this.isProperty ? Namespace.fetch(namespace) : Namespace.create(namespace ,true);
                const desc = this.openingElement.name.description( space , stack );
                return desc ? desc.definition( context ) : null;
            }
        }

        const desc = this.description();
        if( desc && desc !== this.getGlobalTypeById('Node') ){
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
        if( this.__desc === void 0 ){
            this.__desc = null;
            if( this.hasNamespaced ){
                const xmlns = this.getXmlNamespace();
                const jsxConfig = this.compiler.options.jsx || {};
                let sections = jsxConfig.xmlns && jsxConfig.xmlns.sections;
                const nsStack = this.getNamespaceStack();
                let namespace = xmlns && xmlns.value ? xmlns.value.value() : jsxConfig.xmlns.default[ nsStack.namespace.value() ];
                let load = true;
                if( namespace && sections[namespace]){
                    const sects = sections[namespace];
                    const isAll = sects[0] === '*';
                    if( isAll || sects.includes( this.openingElement.name.value() ) ){
                        load = false;
                        if( namespace === '@slots' ){
                            this.isSlot = true;
                            return null;
                        }else if( namespace === '@directives'){
                            this.isDirective = true;
                            return null;
                        }
                    }else{
                        this.openingElement.name.error(1125, sects.join(',') );
                    }
                }

                if( load ){
                    const space = this.isProperty ? this.parentStack.getSubClassDescription() : Namespace.create(namespace ,true);
                    this.__desc = this.openingElement.name.description( space );
                    if( this.__desc && this.__desc.isModule ){
                        this.compilation.addDependency(this.__desc, this.module);
                    }
                    if( !this.__desc ){
                        const id = space && space.isNamespace ? space.getChain().concat( this.openingElement.name.value() ).join('.') : this.openingElement.name.value();
                        if( this.isProperty ){
                            this.openingElement.name.error(1080, id );
                        }else{
                            this.openingElement.name.error(1111, id );
                        }
                    }else if( this.isModuleForWebComponent(this.__desc) ){
                        this.isWebComponent = true;
                    }else if( this.isModuleForSkinComponent( this.__desc ) ){
                        this.isSkinComponent = true;
                    }else{
                        //this.openingElement.name.error(1134, this.openingElement.name.value() );
                    }
                }

            }else{
                const name = this.openingElement.name.value();
                let maybeModule = this.scope.define( name ) || this.getModuleById(name);
                if( maybeModule ){
                    this.__desc = maybeModule;
                    maybeModule = maybeModule.type();
                    if( this.isModuleForWebComponent(maybeModule) ){
                        this.isWebComponent = true;
                        this.compilation.addDependency(maybeModule , this.module);
                    }else if( this.isModuleForSkinComponent(maybeModule) ){
                        this.isSkinComponent = true;
                        this.compilation.addDependency(maybeModule , this.module);
                    }else{
                        //this.openingElement.name.error(1134, name );
                    }
                }else{
                    this.__desc = this.getGlobalTypeById('VNode');
                }
            }
        }
        return this.__desc;
    }

    type(ctx){
        if( this._type ){
            return this._type;
        }
        // if( this.isSlotDeclared ){
        //     if( this.openingElement.attributes.length > 0 ){
        //         const properties = new Map();
        //         this.openingElement.attributes.forEach( attr=>{
        //             properties.set( attr.name.value(), attr.value.description() );
        //         })
        //         return this._type = new LiteralObjectType( this.getGlobalTypeById('object'), this, properties);
        //     }
        //     return this._type = this.getGlobalTypeById('void');
        // }
        const desc = this.description();
        return this._type = desc ? new InstanceofType(desc.type(), this) : this.getGlobalTypeById('nullable');
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
        const desc = this.description();
        if( desc && module ){
            const type = desc.type();
            if( type && type.isModule && module.extends[0] === type){
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

    parserPropertyValue(acceptType){
        const children = this.children;
        if( children.length !== 1 || !children[0].isJSXExpressionContainer ){
            this.error(1113)
        }else{
            return children[0].description();
        }

        // let value = null;
        // if( !acceptType ){
        //     if( children.length > 1 ){
        //         value = new LiteralArrayType(this.getGlobalTypeById('array'), this, children );
        //     }else {
        //         value = children[0].description();
        //     }
        // }else if(children.length > 0){
        //     if( acceptType.isLiteralArrayType || acceptType === this.getGlobalTypeById('Array') || acceptType === this.getGlobalTypeById('array') ){
        //         value = new LiteralArrayType(this.getGlobalTypeById('array'), this, children );
        //     }else if( acceptType.isTupleType ){
        //         value = new TupleType(this.getGlobalTypeById('array'), children , this);
        //     }else if( acceptType.isLiteralObjectType || acceptType === this.getGlobalTypeById('Object') || acceptType === this.getGlobalTypeById('object') ){
        //         const attributes = new Map();
        //         const target = Object.create(this);
        //         children.forEach( item=>{
        //             const key = item.nodeName;
        //             const _desc = item.description();
        //             let _acceptType = item.getDescriptionAcceptType(_desc); 
        //             const attrType = item.attributes.find( item=>item.name.value() === 'type' );
        //             const attrValue = item.attributes.find( item=>item.name.value() === 'value' );
        //             if( attrType ){
        //                 _acceptType = this.getGlobalTypeById( attrType.value.value() );
        //                 if( !_acceptType ){
        //                     attrType.value.error(1083);
        //                 }
        //             }
        //             let init = item.children.length > 0 ? item.parserPropertyValue( _acceptType ) : null;
        //             if( !init && attrValue ){
        //                 init = attrValue.value.description();
        //             }
        //             if( typeof init === 'string' ){
        //                 init = this.getGlobalTypeById('string');
        //             }
        //             if( init && _acceptType ){
        //                 if( !_acceptType.check( init ) ){
        //                     item.error(1009, init.type().toString(), _acceptType.toString() );
        //                 }
        //             }
        //             attributes.set(key, {key,init});
        //         });
        //         target.isAttrClone = true;
        //         target._attributes = attributes;
        //         target.attribute = function(name, value){
        //             if( value !== void 0 ){
        //                 this.attributes.set(name,value);
        //                 return value;
        //             }
        //             return this.attributes.get(name) || null;
        //         }
        //         value = new LiteralObjectType(this.getGlobalTypeById('object'), target);
        //     }else{
        //         if( children.length === 1 ){
        //             value = children[0].description();
        //         }else{
        //             value = this.getGlobalTypeById('string');
        //         }
        //     }
        // }
        // return value;
    }

    getSlotDescription(slotName, classModule){
        let parentComponent = classModule || this.parentStack && this.parentStack.description();
        const define= (desc)=>{
            var stackModule = this.compilation.getStackByModule( desc );
            if( stackModule ){
                const annotation =stackModule.annotations && stackModule.annotations.find( annotation=>{
                    if( annotation.name.toLowerCase() === 'define' ){
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
                            if( key ==='scope' ){
                                obj.args.push({
                                    name:item.value,
                                    stack:item.stack,
                                    type:acceptType ? acceptType.type() : this.getGlobalTypeById('any')
                                });
                            }
                        }else if( index > 0 ){
                            obj.args.push({
                                name:item.value,
                                stack:item.stack,
                                type:acceptType ? acceptType.type() : this.getGlobalTypeById('any')
                            });
                        }
                    });
                    return obj;
                }
            }
        }
        while( parentComponent ){
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

                if( attrs.length < 2 || attrs.length > 4  ){
                    this.openingElement.name.error(1145, 2, attrs.length)
                }else{
                    if( !attrs.every( attr=>['name','item','key','index'].includes( attr.name.value() ) ) ){
                        this.openingElement.name.error(1144, ['name','item','key','index'].join(', ') )
                    }else{
                        const resource = attrs.find( attr=>attr.name.value() ==='name' );
                        const description = resource.description();
                        const descType = description && description.type();
                        const originType = Utils.getOriginType( descType );
                        if( originType && !originType.isAnyType ){
                            if( directiveName ==="each" && !this.getGlobalTypeById('array').is( descType ) ){
                                resource.value.error(1119, descType.toString() );
                            }else if( originType.isNullableType || originType.isNeverType || originType.isVoidType || this.getGlobalTypeById('boolean').is(originType) ){
                                resource.value.error(1049,  descType.toString() );
                            }
                        }

                        const mapTypes = {
                            'item':descType ? MergeType.forOfItem( descType ) : this.getGlobalTypeById('any'),
                            'key':this.getGlobalTypeById('string'),
                            'index':this.getGlobalTypeById('number'),
                        }

                        attrs.forEach( attr=>{
                            const stack = attr.description();
                            if( stack ){
                                const name = stack.value();
                                const key = attr.name.value().toLowerCase();
                                if( name && Object.prototype.hasOwnProperty.call(mapTypes, key) ){
                                    (function(stack, _type){
                                        stack.isDeclarator = true;
                                        stack.kind = "const";
                                        stack.type = function type(){
                                            return _type;
                                        }
                                        stack.description = function description(){
                                            return this;
                                        }
                                        stack.definition=function definition(ctx){
                                            return {
                                                expre:`(local var) ${this.value()}:${this.type().toString(ctx|this.getContext())}`,
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
                }
                break;
            }

            case "custom" :{

                // if( this.children.length != 1 ){
                //     this.openingElement.name.error(1174);
                // }else{
                //     const child = this.children[0];
                //     //this.type()
                // }
                
                const pros = {
                    'name':this.getGlobalTypeById('any'),
                    'value':this.getGlobalTypeById('any'),
                    'modifier':this.getGlobalTypeById('object'),
                    'props':this.getGlobalTypeById('object'),
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
        const desc = this.description();
        if( this.isComponent && this.jsxRootElement === this ){
            if( this.compilation.JSX && this.parentStack && this.parentStack.isProgram && (this.isModuleForWebComponent(desc) || this.isModuleForSkinComponent(desc)) ){
               return desc;
            }
        }
        return null;
    }

    parser(){

        if( !super.parser() ){
            return false;
        }

        const jsxConfig = this.compiler.options.jsx || {xmlns:{}};
        const desc = this.description();
        if( desc && desc.isModule && desc.compilation ){
            desc.compilation.parser();
            const descStack = desc.compilation.getStackByModule( desc );
            if(descStack){
                descStack.addUseRef(this);
            }
        }

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
            if( this.compilation.JSX && this.parentStack && this.parentStack.isProgram && (this.isModuleForWebComponent(desc) || this.isModuleForSkinComponent(desc)) ){
                //this.module.extends = desc;
                this.scope.define("this", new InstanceofType(this.module,this) );
            }else if( !this.isWebComponent ){
                //this.openingElement.name.error(1134, this.openingElement.name.value() );
            }
        }

        if( this.isSlot && this.module){
            const slotName = this.openingElement.name.value();
            const pStack = this.getParentStack( stack=>!!(stack.isComponent || !stack.isJSXElement) );
            if( pStack ){
                const declaredSlots = this.module.jsxDeclaredSlots || (this.module.jsxDeclaredSlots=new Map());
                const isDeclareSlot = !pStack.isComponent || (this.compilation.JSX && pStack.jsxRootElement === pStack);
                if( !isDeclareSlot ){
                    if( this.parentStack !== pStack ){
                        this.openingElement.name.error(1127, slotName);
                    }else{
                        const pSlot = this.getSlotDescription(slotName);
                        if( !pSlot ){
                            this.openingElement.name.warn(1126, slotName);
                        }

                        if( pStack.isComponent ){
                        
                            if( this.openingElement.attributes.length > 0 ){
                                const isJsx = pSlot && pSlot.isJSXElement && pSlot.openingElement;
                                const hasDeclareScoped = isJsx && pSlot.openingElement.attributes.length > 0;
                                this.openingElement.attributes.forEach( attr=>{
                                    if( isJsx && !hasDeclareScoped ){
                                        attr.name.error(1130, attr.name.value());
                                    }
                                    if( attr.value ){
                                        this.scope.define(attr.value.value(), attr);
                                    }else{
                                        this.scope.define(attr.name.value(), attr);
                                    }
                                });
                            }

                            const componentsUseSlots = pStack.componentsUseSlots || (pStack.componentsUseSlots = {});
                            if( componentsUseSlots[slotName] === true ){
                                this.openingElement.name.error(1129,slotName);
                            }else{
                                componentsUseSlots[slotName]=true;
                            }

                        }
                    }
                }else{
                    this.isSlotDeclared = true;
                    if( declaredSlots.has(slotName) ){
                        this.openingElement.name.error(1129,slotName);
                    }else{
                        declaredSlots.set(slotName, this);
                    }
                }
            }else{
                this.openingElement.name.error(1127, slotName);
            }
        }

        const attributes = this.openingElement.attributes;
        // const parseAttributeStack = (attrItem,attrDesc)=>{

        //     if(attrDesc){
        //         let acceptType = null;
        //         if(attrDesc.isMethodSetterDefinition){
        //             const param = attrDesc.params[0];
        //             if( param ){
        //                 acceptType = param.acceptType.type();
        //             }
        //         }else if( attrDesc.isPropertyDefinition ){
        //             acceptType = attrDesc.acceptType.type();
        //         }

        //         if( acceptType ){
        //             const items =  acceptType.isUnionType ? acceptType.elements : [acceptType];
        //             if( items.some( item=>item && Utils.getOriginType(item.type()) === this.getGlobalTypeById('String') ) ){
        //                 return;
        //             }
        //         }
        //     }

        //     if( attrItem.value && attrItem.value.isLiteral ){
        //         const text = attrItem.value.value().trim();
        //         if( text.charCodeAt(0)===64 )return;
        //         const expression = attrItem.parserAttributeValueStack();
        //         if(expression){
        //             const desc = expression.description();
        //             if( desc ){
        //                 desc.parser();
        //                 expression.isJSXExpressionContainer = true;
        //                 attrItem.value = expression;
        //             }
        //         }
        //     }

        // };

        const cacheAttrs = {};
        attributes.forEach( item=>{
            item.parser();
            const name = item.getAttributeName();
            if( cacheAttrs[name] === true ){
                item.error( 1045, name);
            }
            cacheAttrs[name] = true;
            if( !item.isAttributeXmlns && !item.isAttributeDirective && !item.isAttributeEvent && !item.isAttributeSlot && !item.isAttributeBinding ){
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
        if( this.isWebComponent && desc && !desc.isDeclaratorModule ){
            if( !(desc.isSkinComponent || desc.isWebComponent) || this.jsxRootElement !== this ){
                needCheckSlotDefine = true;
                pSlots = desc.jsxDeclaredSlots;
                if( pSlots && pSlots.has('default') ){
                    hasDefaultSlot = true;
                }else {
                    hasDefaultSlot = !!this.getSlotDescription('default', desc);
                }
            }
        }

        this.children.forEach( item=> {
            item.parser();
            if( !item.isSlot && needCheckSlotDefine && !hasDefaultSlot ){
                if( desc.isModule ){
                    item.warn(1131, desc.getName() );
                }else if(desc.isStack){
                    item.warn(1131, desc.value() );
                }
            }
        });

        return true;
    }

    value(){
        return this.openingElement.value();
    }
}

module.exports = JSXElement;