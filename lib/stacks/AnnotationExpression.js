const MergeType = require("../core/MergeType");
const Stack = require("../core/Stack");
const Utils = require("../core/Utils");;
const ClassGenericType = require("../types/ClassGenericType");
const path = require("path");
const Namespace = require("../core/Namespace");

const keyMapIndexes = {
   http:['classname','action', 'param', 'data','method','config'],
   router:['classname','action', 'param']
}

class AnnotationExpression extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isAnnotationExpression=true;
        this.body = (node.body || []).map( item=>{
            const stack = this.createTokenStack(compilation,item,scope,node,this);
            if( item.acceptType ){
                stack.acceptType = this.createTokenStack(compilation,item.acceptType,scope,node,this);
            }
            return stack;
        });
        const name = String(this.node.name).toLowerCase();
        this._lowerName = name;
        const isServer = ['provider','http','router'].includes(name);
        if(isServer){
            const args = this.getArguments();
            const item = this.getAnnotationArgumentItem('classname', args, ['classname']);
            if(item){
                this.compilation.hookAsync('compilation.create.after',async ()=>{
                    const desc = await this.loadTypeAsync(item.value); 
                    if(desc && desc.isModule){
                        this.compilation.addDependency(desc, this.module)
                    }
                });
            }
            const response = this.getAnnotationArgumentItem('response', args);
            if( response ){
                this.compilation.hookAsync('compilation.create.after',async ()=>{
                    const desc = await this.loadTypeAsync(response.value);
                    if(desc && desc.isModule){
                        this.compilation.addDependency(desc, this.module)
                    }
                });
            }
        }
    }
    get name(){
        return this.node.name;
    }

    getLowerCaseName(){
        return this._lowerName;
    }

    freeze(){
        super.freeze(this);
        super.freeze(this.body);
        super.freeze(this.scope);
        this.body.forEach(stack=>stack.freeze());
    }
    definition(context){
        if( context ){
            let current = context.stack;
            if( current ){
                if( current.parentStack.isAssignmentPattern ){
                    current = current.parentStack
                }
                const index = this.body.indexOf(current);
                if( index >= 0 ){
                    const name = this.getLowerCaseName();
                    const args = this.getArguments();
                    const itemArg = args[index];
                    if( name ==='http' || name ==='router' ){
                        const key = this.getArgNamed(itemArg)
                        if(key==='classname'){
                            const provideModule = args[0] ? this.getModuleById( args[0].value ) : null;
                            if(provideModule && provideModule.isModule){
                                return provideModule.definition(context)
                            }
                        }else if(key==='action'){
                            const provideModule = args[0] ? this.getModuleById( args[0].value ) : null;
                            if(provideModule && itemArg && this.isModuleForWebComponent(provideModule)){
                                let stack = itemArg.stack;
                                if(stack.isAssignmentPattern)stack=stack.right;
                                const desc = stack.description();
                                if( desc && desc.isStack ){
                                    return desc.definition(context);
                                }
                            }else{
                                const result = this.getProviderDescriptor(args);
                                if( result ){
                                    const [desc] = result;
                                    if( desc ){
                                        return desc.definition(context);
                                    }
                                }
                            }

                        }else if(key==='method'){
                            return {
                                expre:`(type) "${itemArg.value}"`,
                                location:itemArg.stack.getLocation(),
                                file:this.compilation.file,
                            };
                        }else if(itemArg){
                            let stack = itemArg.stack;
                            if(stack.isAssignmentPattern)stack=stack.right;
                            const desc = stack.description();
                            if( desc && desc.isStack ){
                                return desc.definition(context);
                            }
                        }
                    }
                }
            }
            return null;
        }
        return {
            expre:`(Annotation) ${this.name}`,
            file:this.compilation.file,
        };
    }
    description(){
        return this;
    }
    getArguments(){
        if( this._args ){
            return this._args;
        }
        const target= this._args = [];
        this.body.map( (item,index)=>{
            if(item.isAssignmentPattern){
                const key =item.left.value();
                const value = item.right.value();
                const assigned = true;
                target.push({key,value,assigned,stack:item});
            }else if(item.isObjectPattern){
                item.error(1176, item.raw() );
            }else if(item.isArrayPattern){
                item.error(1176, item.raw() );
            }   
            else if(item.isIdentifier || item.isLiteral || item.isCallExpression || item.isNewExpression || item.isConditionalExpression || item.isMemberExpression || item.isArrayExpression || item.isObjectExpression ){
                const key = index;
                const value = item.isIdentifier || item.isLiteral || item.isMemberExpression ? item.value() : '';
                const assigned = false;
                target.push({key,value,assigned,stack:item});
            }else{
                item.error(1176, item.raw() );
            }
        });
        return target;
    }

    getProviderDescriptor(args=null){
        args = args || this.getArguments();
        return this.getAttribute('getProviderDescriptor',()=>{
            const classNameArg = args.find( item=>String(item.key).toLowerCase()==='classname' ) || args[0];
            const actionArg = args.find( item=>String(item.key).toLowerCase()==='action' ) || args[1];
            const provideModule = classNameArg ? this.getModuleById( classNameArg.value ) : null;
            if(provideModule && provideModule.isModule && actionArg ){
                const flag = provideModule.compilation.parserDoneFlag;
                const desc = provideModule.getMember( actionArg.value );
                if( desc && desc.isMethodDefinition && !desc.isAccessor && Utils.isModifierPublic(desc) ){
                    return [desc, flag, provideModule];
                }
            }
            return null;
        })
    }

    getDescriptorByStack(stack){
        const name = this.getLowerCaseName()
        if(!(name ==='http' || name ==='router')){
            return null;
        }
        const args = this.getArguments();
        const arg = args.find( arg=>arg.stack === stack);
        if(arg){
            const [desc, _, classModule] = this.getProviderDescriptor(args) || [];
            const key = this.getArgNamed(arg);
            if(key==='action'){
                return desc
            }else if(key==='classname'){
                return classModule;
            }
        }
        return null;
    }

    type(){
        switch ( this.getLowerCaseName() ) {
            case 'env':{
                const args = this.getArguments();
                if( args.length>1 ){
                    return Namespace.globals.get('boolean');
                }else if( args.length>0){
                    return Namespace.globals.get('string');
                }
                return Namespace.globals.get('nullable');
            }
            case 'url' :
            case 'provider':
                return Namespace.globals.get('string');
            case 'router':
                return Namespace.globals.get('annotation.IRouter');
            case 'http':
                if(this._type)return this._type;
                const args = this.getArguments();
                const response = args.find( arg=>String(arg.key).toLowerCase() ==='response' );
                const HttpResponse = Namespace.globals.get('net.HttpResponse');
                const responseField = this.compiler.options.metadata.http.responseField;
                let typeValue = null;
                let flag = true;
                const ctx = this.getContext();
                const getResponseType=()=>{
                    const [desc,_flag] = this.getProviderDescriptor(args) || [];
                    if( desc ){
                        flag = _flag;
                        let value = desc.inferReturnType();
                        if( value ){
                            value =MergeType.to(value.type());
                            if( value.isClassGenericType && value.types[0]){
                                value = value.types[0].type();
                            }
                            if( value ){
                                value = ctx.apply(value);
                            }
                            if(value && !value.isGenericType){
                                return value;
                            }
                        }
                    }
                    return Namespace.globals.get('any');
                }

                if( response || responseField ){
                    const type = response && (this.scope.define( response.value ) || this.getModuleById(response.value));
                    if( type && (type.isTypeStatement || type.isModule) ){
                        return this._type = type.type();
                    }else{
                        const desc = HttpResponse.getMember( response ? response.value : responseField, 'get' );
                        const declareGenerics = HttpResponse.getModuleGenerics();
                        if( desc ){
                            typeValue = desc.type();
                            if( declareGenerics && declareGenerics.length > 0 ){
                                const index = declareGenerics.indexOf(typeValue);
                                if( index === 0 ){
                                    typeValue = getResponseType();
                                }
                            }
                        }
                        if(!typeValue){
                            typeValue = Namespace.globals.get('any');
                        }
                    }
                }else{
                    typeValue = new ClassGenericType(
                        [getResponseType()],
                        HttpResponse,
                        false,
                        HttpResponse.moduleStack
                    );
                }
                const Promise = Namespace.globals.get('Promise');
                const _type =  new ClassGenericType(
                    [typeValue],
                    Promise,
                    false,
                    Promise.moduleStack
                );
                if( !flag )return _type;
                return this._type = _type;
            default:
                break;
        }
        return Namespace.globals.get('any');
    }

    getArgNamed(arg){
        const indexes= keyMapIndexes[this.getLowerCaseName()];
        if(!arg.assigned && indexes[arg.key]){
            return indexes[arg.key];
        }
        return String(arg.key).toLowerCase();
    }

    parser(){
        if(super.parser()===false)return false;
        const args = this.getArguments();
        const item = this.getAnnotationArgumentItem('classname', args, ['classname']);
        const name = this.getLowerCaseName();
        const isServer = ['provider','http','router'].includes(name);
        if( name ==='http' || name ==='router'){
            args.forEach( item=>{
                let stack = item.stack;
                let key = this.getArgNamed(item);
                if(key!=='method'){
                    if(key==='action'){
                        const result = this.getProviderDescriptor(args);
                        if(result){
                            const [desc,_, ownerModule] = result
                            if(desc && ownerModule){
                                stack.setRefBeUsed(desc);
                            }
                        }
                    }else{
                        stack.parser();
                        if( stack.isAssignmentPattern ){
                            stack = item.stack.right;
                        }
                        if(stack.isCallExpression||stack.isNewExpression){
                            stack = stack.callee;
                        }
                        stack.setRefBeUsed();
                    }
                }
            });
        }

        if( isServer ){
            if( !item ) {
                this.error(1001, 1, 0);
            }else{
                const moduleClass = this.getModuleById(item.value);
                if( !moduleClass ){
                    item.stack.error(1027, item.value);
                }else{
                    //this.compilation.addDependency(moduleClass, this.module);
                    item.stack.setRefBeUsed(moduleClass)
                    if( name ==="http" ) {
                        const response = this.getAnnotationArgumentItem('response', args);
                        if( response ){
                            const HttpResponse = Namespace.globals.get('net.HttpResponse');
                            let type = HttpResponse.getMember( response.value, 'get' )
                            if( !type ){
                                type = this.scope.define( response.value ) || this.getModuleById(response.value);
                                response.stack.setRefBeUsed(type);
                            }
                            if( !type || !(type.isTypeStatement || type.isType) ){
                                response.stack.error(1175, response.value);
                            }
                        }
                    }
                }
            }
        }else if( name ==='url' ){
            if( args.length != 1 ){
                this.error(1001, 1, args.length);
            }else{
                args.forEach( item=>{
                    let flag = item.value.charCodeAt(0) === 64;
                    let file = flag ? item.value.substr(1) : this.compiler.resolve(item.value, this.file ? path.dirname(this.file) : null);
                    if( !file ){
                        file = this.compiler.normalizePath(item.value);
                        item.resolveFile = file;
                    }else{
                        item.resolveFile = this.compiler.normalizePath(file);
                    }
                    if( file ){
                        const top = this.module ? this.compilation.getStackByModule(this.module) : this.compilation;
                        const name = path.basename(item.resolveFile) || file;
                        const assign = top.scope.generateVarName( name.replace(/(\W)+/g, '_') );
                        const target = this.module || this.compilation;
                        target.addAsset(item.resolveFile, item.value, null, path.extname(file), assign, null, this);
                    }
                });
            }
        }else if( name==='env'){

        }
    
    }
}

module.exports = AnnotationExpression;