const MergeType = require("../core/MergeType");
const Stack = require("../core/Stack");
const Utils = require("../core/Utils");;
const ClassGenericType = require("../types/ClassGenericType");
const path = require("path");
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
        const name = this.name.toLowerCase();
        const isServer = ['provider','http','router'].includes(name);
        if(isServer){
            const args = this.getArguments();
            const item = this.getAnnotationArgumentItem('classname', args, ['classname']);
            if(item){
                this.compilation.hookAsync('compilation.create.after',async ()=>{
                    await this.loadTypeAsync(item.value); 
                });
            }
            const response = this.getAnnotationArgumentItem('response', args);
            if( response ){
                this.compilation.hookAsync('compilation.create.after',async ()=>{
                    await this.loadTypeAsync(response.value);
                });
            }
        }
    }
    get name(){
        return this.node.name;
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
                    const name = this.name.toLowerCase();
                    const args = this.getArguments();
                    const itemArg = args[index];
                    if( name ==='http' || name ==='router' ){
                        if( index===0){
                            const provideModule = args[0] ? this.getModuleById( args[0].value ) : null;
                            if(provideModule && provideModule.isModule){
                                return provideModule.definition(context)
                            }
                        }else if( index === 1 ){
                            const provideModule = args[0] ? this.getModuleById( args[0].value ) : null;
                            if(provideModule && itemArg && this.isModuleForWebComponent(provideModule)){
                                let stack = itemArg.stack;
                                if(stack.isAssignmentPattern)stack=stack.right;
                                const desc = stack.description();
                                if( desc && desc.isStack ){
                                    return desc.definition(context);
                                }
                            }else /*if( String(itemArg.key).toLowerCase()==='action' )*/{
                                const result = this.getProviderDescriptor(args);
                                if( result ){
                                    const [desc] = result;
                                    if( desc ){
                                        return desc.definition(context);
                                    }
                                }
                            }

                        }else if( index > 1 && itemArg ){
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

    getProviderDescriptor(args){
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
    }

    type(){
        switch ( this.name.toLowerCase() ) {
            case 'env':{
                const args = this.getArguments();
                if( args.length>1 ){
                    return this.getGlobalTypeById('boolean');
                }else if( args.length>0){
                    return this.getGlobalTypeById('string');
                }
                return this.getGlobalTypeById('nullable');
            }
            case 'url' :
            case 'provider':
                return this.getGlobalTypeById('string');
            case 'router':
                return this.getGlobalTypeById('annotation.IRouter');
            case 'http':
                if(this._type)return this._type;
                const args = this.getArguments();
                const response = args.find( arg=>String(arg.key).toLowerCase() ==='response' );
                const HttpResponse = this.getGlobalTypeById('net.HttpResponse');
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
                    return this.getGlobalTypeById('any');
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
                            typeValue = this.getGlobalTypeById('any');
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
                const Promise = this.getGlobalTypeById('Promise');
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
        return this.getGlobalTypeById('never');
    }

    parser(){
        if(super.parser()===false)return false;
        const args = this.getArguments();
        const item = this.getAnnotationArgumentItem('classname', args, ['classname']);
        const name = this.name.toLowerCase();
        const isServer = ['provider','http','router'].includes(name);
        if( name ==='http' || name ==='router'){
            args.forEach( item=>{
                let key = String(item.key).toLowerCase();
                if( name==='http' ){
                    const indexes=['classname','action', 'param', 'data','method','config'];
                    if(item.key >= 2 && !item.assigned && indexes[item.key]){
                        key = indexes[item.key]
                    }
                }else if( name==='router' ){
                    const indexes=['classname','action', 'param'];
                    if(item.key >= 2 && !item.assigned && indexes[item.key]){
                        key = indexes[item.key]
                    }
                } 
                if(key==='data' || key==='param' || key==='params' || key==='config'){
                    let stack = item.stack;
                    if( stack.isAssignmentPattern ){
                        stack = item.stack.right;
                    }
                    if(stack.isCallExpression||stack.isNewExpression){
                        stack = stack.callee;
                    }
                    while(stack.isMemberExpression)stack = stack.object;
                    if( stack.isIdentifier ){
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
                    this.compilation.addDependency(moduleClass, this.module);
                    if( name ==="http" ) {
                        const response = this.getAnnotationArgumentItem('response', args);
                        if( response ){
                            const HttpResponse = this.getGlobalTypeById('net.HttpResponse');
                            let type = HttpResponse.getMember( response.value, 'get' )
                            if( !type ){
                                type = this.scope.define( response.value ) || this.getModuleById(response.value);
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
                        target.addAsset(item.resolveFile, item.value, null, path.extname(file), assign);
                    }
                });
            }
        }else if( name==='env'){

        }
    
    }
}

module.exports = AnnotationExpression;