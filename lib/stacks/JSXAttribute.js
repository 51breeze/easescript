const BlockScope = require("../scope/BlockScope");
const Stack = require("../core/Stack");
const MergeType = require("../core/MergeType");
const Utils = require("../core/Utils");
const {Parser} = require("../core/Parser");
const Declarator = require("./Declarator");
const Namespace = require("../core/Namespace");
const LiteralObjectType = require("../types/LiteralObjectType");
class JSXAttribute extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isJSXAttribute= true;
        this.jsxElement = parentStack.jsxElement;
        this.name = this.createTokenStack( compilation, node.name, this.scope, node, this );
        this.value = this.createTokenStack( compilation, node.value, this.scope, node, this );
        this.hasNamespaced = !!this.name.isJSXNamespacedName;
        this.isAttributeXmlns = this.hasNamespaced ? this.name.namespace.value().toLowerCase() === 'xmlns' : false;
        this.isAttributeDirective = false;
        this.isMemberProperty = false;
        if( this.isAttributeXmlns && parentStack && parentStack.parentStack.isJSXElement){
            parentStack.parentStack.xmlns.push(this);
        }
        if( this.isAttributeXmlns && this.jsxElement.jsxRootElement !== this.jsxElement){
            this.name.error(1117);
        }
        if( this.hasNamespaced && !this.isAttributeXmlns ){
            const xmlns = this.name.getXmlNamespace();
            const jsxConfig = this.compiler.options.jsx || {};
            let ns = null;
            if( xmlns && xmlns.value ){
                ns = xmlns.value.value();
            }else{
                const nsStack = this.getNamespaceStack();
                ns = jsxConfig.xmlns && jsxConfig.xmlns.default[ nsStack.namespace.value().toLowerCase() ] || ns;
            } 
            if( ns ){
                let custom = '';
                if( ns.includes('::') ){
                    const [_ns,_custom] = ns.split('::',2);
                    ns = _ns;
                    custom = _custom;
                }
                if( ns ==="@directives" ){
                    const sections = jsxConfig.xmlns && jsxConfig.xmlns.sections;
                    const directives = sections[ns];
                    if(this.value && this.jsxElement.jsxRootElement === this.jsxElement ){
                        this.value.error(1115);
                    }
                    if( directives ){
                        let dName = custom ? custom.toLowerCase() : this.name.value();
                        if( !( directives.includes(dName) || directives.includes('*') ) ){
                            this.name.error(1125, directives.join(',') );
                        }else{
                            this.isAttributeDirective = true;
                        }
                        const newContext = jsxConfig.xmlns.context || [];
                        if( newContext.includes(dName) ){
                            this.scope = new BlockScope(this.scope);
                            this.scope.isDirective = true;
                            this.scope.isForContext = true;
                            this.parentStack.scope = this.scope;
                            this.parentStack.parentStack.scope = this.scope;
                        }
                    }
                }else if(ns==="@slots"){
                    this.isAttributeSlot = true;
                    this.jsxElement.hasAttributeSlot = true;
                    if( this.value ){
                        this.scope = new BlockScope(this.scope);
                        this.scope.isAttributeSlotScope = true;
                        this.parentStack.scope = this.scope;
                        this.parentStack.parentStack.scope = this.scope;
                    }
                }else if( ns==="@events" || ns==="@natives"){
                    this.isAttributeEvent = true;
                }else if( ns==="@binding" ){
                    this.isAttributeBinding = true;
                }
            }
        }

        this.addHook();
    }

    addHook(){
        if( this.isAttributeXmlns ){
            let namespace =  this.value && this.value.value();
            if( namespace ){
                if( namespace.includes('::') ){
                    const [_ns,defineClass] = namespace.split('::',2);
                    if( _ns ==="@events"){
                        this.compilation.hookAsync('compilation.create.after',async ()=>{
                            await this.loadTypeAsync(defineClass);
                        });
                    }
                }
            }
        }
    }

    freeze(){
        super.freeze();
        this.name.freeze();
        this.value.freeze();
    }
    definition( context ){
       
        if( this.isAttributeXmlns ){
            const str = [this.name.name.value(),this.value && this.value.value()].filter( value=>!!value ).join(': ')
            return {
                kind:'namespace',
                comments:null,
                identifier:this.name.name.value(),
                expre:`(xmlns) ${str}`,
                location:this.value ? this.value.getLocation() : this.name.name.getLocation(),
                file:this.compilation.file,
                range:this.name.node.loc
            };
        } else if( this.isAttributeDirective ){
            return null;
        }

        if( this.hasNamespaced ){
            var xmlns = this.getXmlNamespace();
            var namespace = xmlns && xmlns.value ? xmlns.value.value() : null;
            if( namespace && namespace.includes('::') ){
                const [namespace,defineClass] = namespace.split('::',2);
                if( namespace ==="@events"){
                    const defineClassModule = this.getModuleById( defineClass );
                    if( defineClassModule ){
                        const desc = this.getAttributeDescription( defineClassModule, 'get' );
                        if( desc ){
                            const def = desc.definition( context );
                            if( def ){
                                def.range = this.name.name.getLocation();
                                return def;
                            }
                        }
                    }
                }
            }
        }

        if( this.isAttributeSlot && this.value ){
            return {
                expre:`(local var) ${this.value.value()}: ${this.type().toString()}`,
                location:this.value.getLocation(),
                file:this.file
            };
        }else if( this.jsxElement.isSlot ){
            const isLocal = context ? context.stack !== this.name : false;
            if( this.jsxElement.isSlotDeclared ){
                if( this.value ){
                    const desc = this.value.description();
                    return {
                        expre:`(refs) ${this.name.value()}: ${this.value.type().toString()}`,
                        location:desc && desc.isStack ? desc.getLocation() : this.value.getLocation(),
                        file:desc && desc.isStack  ? desc.file : this.value.file
                    };
                }else{
                    return {
                        expre:`(refs) ${this.name.value()}: any`,
                        location:this.name.getLocation(),
                        file:this.name.file
                    };
                }
            }else{

                const el = this.jsxElement;
                const slotName = el.openingElement.name.value();
                const desc = el.getSlotDescription(slotName);
                const key = this.value ? this.value : this.name;
                let type = Namespace.globals.get('any');
                let stack = key;
                if( desc ){
                    if( desc.isJSXElement ){
                        const attributes = desc.openingElement ? desc.openingElement.attributes : [];
                        const _key = this.name.value();
                        const attr = attributes.length ===1 ? attributes[0] : attributes.find( attr=>attr.name.value() === _key );
                        if( attr && attr.isJSXAttribute && attr.value){
                            stack = attr.name;
                            type = attr.value.type();
                        }
                    }else if( desc.isAnnotation && desc.args && desc.args.length > 0 ){
                        const _key = this.name.value();
                        const argument = desc.args.length === 1 ? desc.args[0] : desc.args.find( arg=>arg.name===_key );
                        if( argument ){
                            if(argument.stack)stack = argument.stack;
                            if(argument.type)type = argument.type;
                        }
                    }
                }
                if( isLocal ){
                    return {
                        expre:`(local var) ${key.value()}: ${type.toString()}`,
                        location:key.getLocation(),
                        file:key.file
                    };
                }else{
                    return {
                        expre:`(refs) ${key.value()}: ${type.toString()}`,
                        location:stack.getLocation(),
                        file:stack.file
                    };
                }
            }
        }

        const desc = this.description();
        if( desc ){
            const def = desc.definition( context );
            return def;
        }
        const elem = this.parentStack.parentStack;

        if( elem && elem.isJSXStyle && elem.absoluteFile ){
            return {
                kind:'attr',
                comments:null,
                identifier:this.name.value(),
                expre:`(attr) ${this.name.value()}: ${elem.absoluteFile.replace(/\\/g,'/')}`,
                location:{
                    start:{column:0,line:1},
                    end:{column:0,line:1},
                },
                range:(context.stack || this.value).getLocation(),
                file:elem.absoluteFile
            };
        }
        return null;
    }
    reference(){
        return null;
    }
    referenceItems(){
        return [];
    }

    getNamespaceStack(){
        if( this.name.isJSXNamespacedName ){
            return this.name;
        }else if( this.name.isJSXMemberExpression && this.name.object.isJSXNamespacedName ){
            return this.name.object;
        }
        return null;
    }

    getXmlNamespace(ns){
        if( this.parentStack.isJSXOpeningElement ){
            const stack = this.getNamespaceStack();
            return this.parentStack.getXmlNamespace(ns || stack.namespace.value());
        }
        return null;
    }

    getAttributeDescription(desc, kind='set'){
        if(desc && desc.isModule){
            const argument = this.value ? this.value : Namespace.globals.get('boolean');
            const name = this.name.isJSXNamespacedName ? this.name.name.value() : this.name.value()
            return desc.getDescriptor(name, (desc, prev, index)=>{
                if( desc.isMethodSetterDefinition ){
                    const params = desc.params || [];
                    if( params[0] && this.checkMatchType(argument, params[0], argument.type())){
                        return true;
                    }
                    return desc;
                }else if( desc.isPropertyDefinition && !desc.isReadonly ){
                    if( this.checkMatchType(argument, desc, argument.type())){
                        return true;
                    }
                    return desc;
                }
                return false
            });
        }
        return null;
    }

    description(){
        if( this.isAttributeDirective || this.jsxElement.isDirective ){
            return this._directiveDesc;
        }else if(!this.isAttributeXmlns){
            return this.getAttribute('description',()=>{
                const value = this.value;
                let desc = null;
                if( this.jsxElement.isSlot ){
                    if( this.jsxElement.isSlotDeclared ){
                        return value ? value.description() : null;
                    }else{
                        const el = this.jsxElement;
                        const slotName = el.openingElement.name.value();
                        desc = el.getSlotDescription(slotName);
                    }
                }else if( this.isAttributeSlot ){
                    desc = this.getSlotAttrDescription();
                }

                if(desc){
                    if( desc.isJSXElement ){
                        const attributes = desc.openingElement ? desc.openingElement.attributes : [];
                        if(attributes.length ===1){
                            return attributes[0].value.description();
                        }else{
                            const properties = new Map();
                            attributes.forEach(attr=>{
                                if(attr.value){
                                    properties.set(attr.name.value(), attr.value)
                                }
                            });
                            return new LiteralObjectType(Namespace.globals.get('object'), null, properties)
                        }
                    }else if( desc.isAnnotation && desc.args && desc.args.length > 0){
                        if(desc.args.length === 1){
                            return desc.args[0].type;
                        }else{
                            const properties = new Map();
                            desc.args.forEach(attr=>{
                                if(attr.type){
                                    properties.set(attr.name, attr.type)
                                }
                            });
                            return new LiteralObjectType(Namespace.globals.get('object'), null, properties)
                        }
                    }
                }

                const elem = this.parentStack.parentStack;
                if( elem.isJSXElement && elem.isComponent ){
                    return this.getAttributeDescription( elem.description() );
                }
            });
        }
        return null;
    }

    type(){
        return this.getAttribute('type',()=>{
            let desc = null;
            if( this.jsxElement.isSlot ){
                if( this.jsxElement.isSlotDeclared ){
                    if( this.value ){
                        return this.value.type();
                    }
                    return Namespace.globals.get('any');
                }else{
                    const el = this.jsxElement;
                    const slotName = el.openingElement.name.value();
                    desc = el.getSlotDescription(slotName);
                }
            }else if(this.isAttributeSlot && this.value ){
                desc = this.getSlotAttrDescription();
            }else{
                return Namespace.globals.get("void");
            }

            if(desc){
                if( desc.isJSXElement ){
                    const attributes = desc.openingElement ? desc.openingElement.attributes : [];
                    const properties = new Map();
                    attributes.forEach(attr=>{
                        if(attr.value){
                            properties.set(attr.name.value(), attr.value)
                        }
                    });
                    return new LiteralObjectType(Namespace.globals.get('object'), null, properties)
                }else if( desc.isAnnotation && desc.args && desc.args.length > 0){
                    const properties = new Map();
                    let props = null;
                    desc.args.forEach(attr=>{
                        if(attr.type && !props){
                            if( (attr.name ==='scope' || attr.name ==='props') && attr.type.isLiteralObjectType){
                                props = attr.type;
                                return;
                            }
                            properties.set(attr.name, attr.type)
                        }
                    });
                    if(props){
                        return props;
                    }
                    return new LiteralObjectType(Namespace.globals.get('object'), null, properties)
                }
            }
            return Namespace.globals.get('any');
        })
    }

    createType(descStack, name, type){
        type = type || descStack.type();
        if( descStack && type ){
            let _type = MergeType.forOfItem(type);
            if( _type !== type ){
                _type.definition=()=>{
                    return {
                        expre:`(local var) ${name}:${_type.toString()}`,
                        location:this.value.getLocation(),
                        file:this.compilation.file,
                    }
                }
            }
            return _type;
        }
        return Namespace.globals.get('any');
    }

    checkConditionStatementDirective(){
        const index = this.jsxElement.parentStack.childrenStack.indexOf( this.jsxElement );
        const prevStack = this.jsxElement.parentStack.childrenStack[ index-1 ];
        if( prevStack && prevStack.isJSXElement  ){
            if( prevStack.isDirective ){
                const directiveName = prevStack.openingElement.name.value().toLowerCase();
                if( directiveName === 'if' || directiveName === 'elseif' ){
                    return true;
                }
            }
            return prevStack.openingElement.attributes.some( item=>{
                if( item.isAttributeDirective ){
                    const directiveName = item.name.value().toLowerCase();
                    return directiveName === 'if' || directiveName === 'elseif';
                }
                return false;
            });
        }
        return false;
    }

    parserDirective(){
        if( this._directiveDesc !== void 0 ){
            return this._directiveDesc;
        }
        this._directiveDesc = null;
        this.valueArgument={expression:null,declare:{}};
        const name = this.name.value().toLowerCase();
        const has = name=>this.scope.define(name);
        let desc = null;
        if( name ==="if" || name ==="elseif" ){
            if(name==='elseif'){
                if( !this.checkConditionStatementDirective() ){
                    this.name.error(1156);
                }
            }
            if( !this.value || (this.value.isLiteral && !this.value.value().trim()) ){
                this.error(1144,`condition`);
            }else{
                desc = this.parserAttributeValueStack();
                this.valueArgument.expression=desc;
            }
        }else if( name ==="each" || name ==="for"){
            if( this.value && this.value.isJSXExpressionContainer ){
                this.value.error(1121);
            }else{
                const value = this.value.value();
                const divide = value.match(/\s+(of|in)\s+/i);
                var item = null;
                if( divide ){
                    const startAt = this.value.node.start+1;
                    item = this.parserAttributeValueStack(this.compilation.source.substr(0,startAt+divide.index), startAt, true);
                    desc = this.parserAttributeValueStack(this.compilation.source.substr(0,startAt+value.length), startAt + divide.index + divide[0].length, false, this.jsxElement.parentStack.scope );
                }else{
                    if( name ==="each" ){
                        this.value.error(1116);
                    }else{
                        this.value.error(1121);
                    }
                }

                if( desc ){
                    this.valueArgument.expression = desc;
                    const descType = desc.type();
                    const originType = Utils.getOriginType( descType );
                    if( originType && !originType.isAnyType ){
                        if( name ==="each" && !Namespace.globals.get('array').is( descType ) ){
                            this.value.error(1119, descType.toString() );
                        }else if( originType.isNullableType || originType.isNeverType || originType.isVoidType || Namespace.globals.get('boolean').is(originType) ){
                            this.value.error(1049, descType.toString() );
                        }
                    }
                }

                if( item ){
                    item.parser();
                    if( item.isParenthesizedExpression ){
                        item = item.expression;
                    }
                    const segments = item.isSequenceExpression ? item.expressions : [ item ];
                    const refType = desc && desc.type();
                    const mapTypes=[
                        refType ? MergeType.forOfItem(refType) : Namespace.globals.get('any'),
                        Namespace.globals.get('string'),
                        Namespace.globals.get('number')
                    ];
                    const mapNames = ['item','key','index'];
                    if( !(segments.length >=1 && segments.length <=3) ){
                        this.value.error(1121);
                    }else{
                        segments.forEach( (stack,index)=>{
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
                                }
                            }(stack, mapTypes[index]));
                            const name = stack.value();
                            if( has(name) ){
                                this.value.error(1045, name);
                            }
                            this.valueArgument.declare[ mapNames[index] ] = name;
                            this.jsxElement.scope.define(name, stack);
                        });
                    }
                }
            }
        }
        else if( name ==="else"){
            if( !this.checkConditionStatementDirective() ){
                this.name.error(1156);
            }
        }else if( name==="custom"){
            if( !this.value ){
                this.name.error(1145,1,0);
            }else if( this.value.isJSXExpressionContainer ){
                const expression = this.value.type();
                if(expression && expression.isLiteralObjectType){
                    const result = ['name','value'].every( name=>{
                        return !!expression.attribute(name);
                    });
                    if( !result ){
                        this.name.error(1171);
                    }
                }else{
                    this.name.error(1171);
                }
            }else{
                this.name.error(1171)
            }
        }
        else{
            desc = this.parserAttributeValueStack();
            this.valueArgument.expression=desc;
        }
        return this._directiveDesc = desc;
    }

    parserSlotScopeParamsStack(){
        if( !this.value || !(this.jsxElement.isSlot || this.isAttributeSlot) )return null;
        return this.getAttribute('parserSlotScopeParamsStack',()=>{
            if(!this.value.isLiteral){
                const value = this.value.isJSXExpressionContainer ? this.value.expression : this.value;
                if(!value)return null;
                if(value.isIdentifier){
                    return new Declarator(this.compilation, value.node, scope, this.node, this);
                }else{
                    this.value.error(1169);
                    return null;
                }
            }
        
            try{
                const scope = this.scope;
                const startAt = this.value.node.start+1;
                const len = this.value.value().length;
                const node = Parser.parseBindingAtom(this.compilation.source.substr(0, startAt+len), startAt, this.compilation.compiler.options.parser);
                if(node.type==='Identifier'){
                    return new Declarator(this.compilation, node, scope, this.node, this);
                }
                const stack = this.createTokenStack(
                    this.compilation, 
                    node,
                    scope, 
                    this.node, 
                    this
                );
                return stack;
            }catch(e){
                this.value.error(1085, e.message );
            }
            return null;
        });
    }

    parserAttributeValueStack( content, startAt = 0, isDeclarator=false, scope=null, noParser=false){
        if( this._attributeValueStack !== void 0 && !content ){
            return this._attributeValueStack;
        }
        const context =  this.jsxElement.getSubClassDescription();
        const createStack = (expression,startAt) =>{
            if( !expression || expression.length === startAt ){
                return null;
            }
            try{
                this.value.module = this.module || context && context.type();
                this.value.isFragment = true;
                let node = Parser.parseExpressionAt(expression, startAt, this.compilation.compiler.options.parser);
                const stack = this.createTokenStack(
                    this.compilation, 
                    node, 
                    scope || this.scope, 
                    this.value.node, 
                    this.value
                );
                if(stack){
                    if(!noParser)stack.parser();
                    if( !isDeclarator ){
                        const desc = stack.description();
                        if( desc ){
                            this.setRefBeUsed( desc );
                        }else{
                            stack.error(1013,stack.value());
                        }
                    }
                }
                return stack;
            }catch(e){
                this.value.error(1085, e.message );
            }
        }

        if( content ){
            return createStack( content , startAt);
        }else if( this.value ){
            if( this.value.isJSXExpressionContainer ){
                return this.value;
            }else{
                const startAt = this.value.node.start+1;
                const len = this.value.value().length;
                return this._attributeValueStack = createStack(this.compilation.source.substr(0, startAt+len),  startAt);
            }
        }
        return null;
    }

    getAttributeName(){
        if( this.hasNamespaced ){
            const nsStack = this.getNamespaceStack();
            if( nsStack ){
                return nsStack.namespace.value().toLowerCase() +':'+nsStack.name.value(); 
            }
        }
        return this.name.value();
    }

    getSlotAttrDescription(){
        if( !this.isAttributeSlot )return null;
        const slotDesc = this.__slotDesc;
        if( slotDesc !== void 0 )return slotDesc;
        const el = this.jsxElement;
        if( el && el.parentStack && el.parentStack.isWebComponent ){
            const slotName = this.name.value();
            return this.__slotDesc = el.parentStack.getSlotDescription(slotName, el.parentStack.description()) || null;
        }
        return null;
    }

    parser(){ 
        if(super.parser()===false)return false;
        
        if(this.value){
            this.value.parser();
        }
        if( this.jsxElement.isDirective){
            const direName = this.jsxElement.openingElement.name.value().toLowerCase();
            if( direName !=="custom" ){
                const name = this.name.value();
                if( ['condition','name','item','key','index'].includes( name ) ){
                    const scope = name ==='name' ? this.jsxElement.parentStack.scope : this.scope;
                    const desc = this.parserAttributeValueStack(null, 0, !(name==='name' || name==='condition'), scope);
                    this._directiveDesc = desc;
                    return true;
                }
            }
        }

        if( this.jsxElement.isSlot){
            if(this.jsxElement.isSlotDeclared){
                if( !this.value ){
                    this.name.error(1170, this.name.value());
                }
            }else{
                if(this.value){
                    let _stack = this.parserSlotScopeParamsStack();
                    if(_stack){
                        if(_stack.isObjectPattern){
                            _stack.properties.forEach( propery=>{
                                if( propery.init.isAssignmentPattern ){
                                    this.scope.define(propery.init.left.value(), propery);
                                }else{
                                    this.scope.define(propery.init.value(), propery);
                                }
                            })
                        }else if(_stack.isDeclarator){
                            this.jsxElement.scope.define(_stack.value(), _stack);
                        }
                    }
                }else{
                    this.jsxElement.scope.define(this.name.value(), this);
                }
            }
        }

        if( this.isAttributeSlot ){
            const el = this.jsxElement;
            const slotName = this.name.value();
            if(el && el.parentStack && el.parentStack.isWebComponent){
                const pSlot = this.getSlotAttrDescription();
                if( !pSlot && slotName !=='default' ){
                    this.name.warn(1126, slotName);
                }
                if( this.value ){
                    let _stack = this.parserSlotScopeParamsStack();
                    if(_stack){
                        if(_stack.isObjectPattern){
                            _stack.properties.forEach( propery=>{
                                if( propery.init.isAssignmentPattern ){
                                    this.scope.define(propery.init.left.value(), propery);
                                }else{
                                    this.scope.define(propery.init.value(), propery);
                                }
                            })
                        }else if(_stack.isDeclarator){
                            this.scope.define(_stack.value(), _stack);
                        }
                    }
                }
            }else{
                this.name.name.error(1157, slotName);
            }
        }

        if( this.isAttributeDirective ){
            this.parserDirective();
        }else if( this.isAttributeBinding ){
            if( this.value && !this.value.isJSXExpressionContainer ){
                this.parserAttributeValueStack();
            }
        }else{
            const nsStack = this.getNamespaceStack();
            const jsxConfig = this.compiler.options.jsx || {xmlns:{}};
            if( this.isAttributeXmlns ){
                let namespace =  this.value && this.value.value();
                if( namespace ){
                    if( namespace.includes('::') ){
                        const [_ns,defineClass] = namespace.split('::',2);
                        if( _ns ==="@events"){
                            const defineClassModule = this.getModuleById( defineClass );
                            namespace = _ns;
                            if( !Utils.isClassType(defineClassModule) ){
                                this.name.error(1027, defineClass );
                            }
                        }
                    }
                }
            }else if( this.hasNamespaced ){
                const xmlns = this.getXmlNamespace() || jsxConfig.xmlns.default[ nsStack.namespace.value().toLowerCase() ];
                if( !xmlns ){
                    this.error(1098, nsStack.namespace.value() );
                }else{
                    let namespace =  xmlns.value && xmlns.value.value();
                    if( namespace && namespace.includes('::') ){
                        const [_,defineClass] = namespace.split('::',2);
                        const defineClassModule = this.getModuleById( defineClass );
                        const desc = defineClassModule && defineClassModule.getMethod( nsStack.name.value(), 'get' ) 
                        if( !desc ){
                            //this.value.error(1080, nsStack.name.value() );
                        }else{
                            this.setRefBeUsed( desc );
                            this.compilation.addDependency(defineClassModule, this.module);
                        }
                    }
                }
            }
        }
        
    }
}

module.exports = JSXAttribute;