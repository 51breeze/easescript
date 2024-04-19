const Stack = require("../core/Stack");
const Utils = require("../core/Utils");
const path = require("path");
const Constant = require("../core/Constant");
const Declarator = require("./Declarator");
const Namespace = require("../core/Namespace");
class AnnotationDeclaration extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isAnnotationDeclaration=true;
        this.body = (node.body || []).map( item=>{
            const stack = this.createTokenStack(compilation,item,scope,node,this);
            if( item.acceptType ){
                stack.acceptType = this.createTokenStack(compilation,item.acceptType,scope,node,this);
            }
            return stack;
        });
        this._additional = null;
        const allowed = this.compiler.options.annotations;
        if( !(allowed.includes( this.name ) || allowed.includes( Utils.firstToUpper(this.name) ) ) ){
            this.error(1140, this.name);
        }
    }

    get name(){
        return this.node.name;
    }

    set additional(stack){
        this._additional = stack;
        const scope = this.scope;
        const args = this.getArguments();
        const name = this.name.toLowerCase();
        if( (name==="import" || name==="require") && args.length === 2 && args[0].isObjectPattern ){
            const source = args[1].value;
            args[0].extract.forEach( prop=>{
                var desc = Namespace.globals.get( source ) || Namespace.fetch(source);
                if( desc ){
                    if( (desc.isAliasType || desc.isLiteralObjectType) && !desc.isModule ){
                        if( desc.isAliasType )desc = desc.inherit;
                        if( desc.isLiteralObjectType ){
                            desc = desc.attribute( prop.key );
                        }else{
                            desc = null;
                        }
                    }else if( desc.isModule ){
                        desc = desc.getMethod( prop.key );
                    }else if( desc.isNamespace ){
                        desc = desc.get( prop.key );
                    }
                    else{
                        desc = null;
                    }
                }
                if( desc ){
                    scope.define(prop.key, desc);
                }else{
                    scope.define(prop.key, new Declarator(this.compilation, prop.stack.key, prop.stack.scope, prop.stack.parentNode, prop.stack.parentStack));
                }
            });
        }else if( name==="import" || name==="require" ){
            args.forEach( item=>{
                if( item.assigned ){
                    if( scope.isDefine( item.key ) ){
                        this.error(1007,item.key); 
                    }else{
                        var desc = Namespace.globals.get( item.value );
                        if( desc ){
                            scope.define(item.key, desc);
                        }else{
                            scope.define(item.key, new Declarator(this.compilation, item.stack.left, item.stack.scope, item.stack.parentNode, item.stack.parentStack));
                        }
                    }
                }
            });
        }
        else if('embed'){

            if( stack && stack.module &&(
                stack.isClassDeclaration ||
                stack.isInterfaceDeclaration ||
                (stack.isEnumDeclaration && !stack.isExpressionDeclare) ||
                stack.isDeclaratorDeclaration)
            ){
                args.forEach( item=>{
                    if( item.assigned ){
                        if( scope.isDefine( item.key ) ){
                            this.error(1007,item.key); 
                        }else{
                            scope.define(item.key, new Declarator(this.compilation, item.stack.left, item.stack.scope, item.stack.parentNode, item.stack.parentStack)); 
                        }
                    }
                });
            }
        }
    }

    get additional(){
        return this._additional;
    }

    getReferenceFiles(){
        return this.getAttribute('getReferenceFiles',()=>{
            const files = [];
            const describePattern = this.compiler.options.describePattern;
            this.getArguments().forEach( item=>{
                const deep = (file,context,isRoot=false)=>{
                    file = this.compiler.getFileAbsolute(file, context, false);
                    if(!file)return;
                    if( Utils.existsSync(file) ){
                        const stat = Utils.getFileStatSync(file);
                        if( stat.isDirectory() ){
                            const list = Utils.readdir(file);
                            if( list ){
                                list.forEach( filename=>deep(filename,file) );
                            }
                        }else if( stat.isFile() && (isRoot || describePattern.test(file)) ){
                            files.push( file );
                        }
                    }else{
                        item.stack.error(1132, file);
                    }
                }
                deep( item.value , this.file, true);
            });
            return files;
        })
    }

    async createCompleted(){
        const aName = this.name.toLowerCase();
        if(aName!=='reference')return;
        if( this.compilation.import ==='manifest' )return null;
        const files = this.getReferenceFiles();
        const compilations = files.map( file=>this.compilation.createChildCompilation(file, null, file, true) )
        const results = await Promise.allSettled(compilations);
        //const items = await this.compiler.callSequential(compilations)
        const items = results.map(result=>result.value).filter( v=>!!v )
        items.forEach( compilation=>{
            if(!compilation.import){
                compilation.import = 'reference';
            }
        });
        this.setAttribute('referenceCompilations', items);
    }

    freeze(){
        super.freeze(this);
        super.freeze(this.body);
        super.freeze(this.scope);
        this.body.forEach(stack=>stack.freeze());
    }
    definition(context){
        const enterStack = context && context.stack;
        if( !enterStack )return false;
        const name = this.name.toLowerCase();
        if( !['import','embed','require'].includes( name ) ){
            return null;
        }
        if( name ==='embed' ){
            const item = this.getArguments().find( item=>{
                return item.stack === enterStack || item.stack.left === enterStack
            })
            const file = item.resolveFile ? this.compiler.normalizePath(item.resolveFile) : item.value;
            return {
                expre:`Embed("${file}")`,
                location:item.stack.getLocation(),
                range:item.stack.getLocation(),
                file:this.compilation.file,
            };
        }else{
            const find = item=>{
                if( item.assigned ){
                    return item.stack.right === enterStack || item.stack.left === enterStack ;
                }else if( item.isObjectPattern ){
                    return item.extract.find( find )
                }else if( item.isProperty ){
                    if( item.stack.init.isAssignmentPattern ){
                        return item.stack.init.right === enterStack || item.stack.init.left===enterStack;
                    }else{
                        return item.stack.init === enterStack;
                    }
                }
                return false;
            }
            let item = this.getArguments().find( find );
            if( item ){
                if( item.isObjectPattern ){
                    item = item.extract.find( find );
                }
                const scope = this.additional.scope || this.scope;
                const desc = scope.define(item.key);
                const file = item.resolveFile ? this.compiler.normalizePath(item.resolveFile) : item.value;
                if( desc ){
                    return {
                        expre:`(refs) ${item.key}:${desc.type().toString()}`,
                        location:desc.isStack ? desc.getLocation() : null,
                        file:desc.isStack ? desc.file : null,
                    };
                }
                if( item.assigned ){
                    return {
                        expre:`${Utils.firstToUpper(name)}(${item.key} = "${file}")`,
                    };
                }else{
                    return {
                        expre:this.raw(),
                    };
                }
            }
        }
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
                const key = item.left.value();
                const value = item.right.value();
                const assigned = true;
                target.push({key,value,assigned,stack:item});
            }else if(item.isObjectPattern){
                const properties = item.properties.map( node=>{
                    const value = node.key.value();
                    const key = node.init.isAssignmentPattern ? node.init.right.value() : node.init.value();
                    return {key,value,isProperty:true,stack:node};
                });
                target.push({isObjectPattern:true,extract:properties,stack:item});
            }else if(item.isArrayPattern){
                
            }
            else{
                const key = index;
                const value = item.value();
                const assigned = false;
                target.push({key,value,assigned,stack:item});
            }
        });
        return target;
    }

    checkImportParams(args){
        if( !args.length || args.length > 3 || (args[0].isObjectPattern && args.length < 2) ){
            this.error( 1001, 2, args.length );
        }else if( args[0].isObjectPattern && !( args[1] && (!args[1].assigned || typeof args[1].value !== "string") ) ){
            args[1].stack.error(1135, this.name);
        }else if( args[2] && !( args[2].value === false || args[2].value === true ) ){
            args[2].stack.error(1135, this.name);
        }
        const fileItem = args[0].isObjectPattern ? args[1] : args[0];
        let resolve = null;
        if( fileItem.value && !(args.length > 1 && args[args.length-1].value === true) ){
            resolve = this.compiler.resolve(fileItem.value, this.file);
            if( !resolve ){
                //fileItem.stack.error(1122, fileItem.value);
                resolve = fileItem.value;
            }else{
                resolve = this.compiler.normalizePath(resolve);
            }
        }
        fileItem.resolveFile = resolve;
        if( args[0].isObjectPattern ){
            const extract = args[0].extract;
            return [ fileItem, extract ];
        }else{
            if( fileItem.assigned ){
                return [ fileItem ];
            }else{
                fileItem.key = path.basename( fileItem.value, path.extname(fileItem.value) );
                return [ fileItem ];
            }
        }
    }

    createRequireModule( args ){
        let [file,extract] = args;
        if( !extract ){
            extract = [file];
        }
        extract.forEach( item=>{
            const topScope = this.compilation.scope;
            const name = item.isProperty ? item.value : item.key;
            const module = this.compilation.createModule(this.namespace, name);
            if( topScope.define(name) === module ){
                //item.stack.error(1107, name);
            }else{
                topScope.define(name, module);
                module.isClass = true;
                module.required = true;
                module.isAnnotationCreated = true;
                this.compilation.addModuleStack(module, this);
                if( !module.addRequire(item.key, name, file.value, file.resolveFile, !!item.isProperty, item.stack) ){
                    //item.stack.error(1107, name);
                }
            }
        });
    }

    extractDependenceRefs(args){
        let [file,extract] = args;
        if( !extract ){
            extract = [file];
        }
        const target = this.additional && this.additional.module || this.compilation;
        extract.forEach( item=>{
            const name = item.isProperty ? item.value : item.key;
            if( !target.addRequire(item.key, name, file.value, file.resolveFile, !!item.isProperty, item.stack) ){
                //item.stack.error(1107, item.value);
            }
        });
    }

    async parserAsync(){
        const _name = this.name.toLowerCase();
        if(_name==='reference'){
            if(!(this.parentStack.isProgram || this.parentStack.isPackageDeclaration)){
                this.error(1103, this.name);
            }
            if( this.compilation.import ==='manifest' )return null;
            const compilations = this.getAttribute('referenceCompilations');
            if( Array.isArray(compilations) ){
                await this.allSettled(compilations, async compilation=>await compilation.parserAsync());
            }
        }
    }

    parser(){
        if(super.parser()===false)return false;
        const args = this.getArguments();
        const _name = this.name.toLowerCase();
        const ownerModule = this.additional && this.additional.module;
        switch( _name ){
            case 'dynamic' :
                if( !this.additional || 
                    !(this.additional.isClassDeclaration || 
                    this.additional.isInterfaceDeclaration || 
                    this.additional.isDeclaratorDeclaration || 
                    (this.additional.isEnumDeclaration && !this.additional.isExpressionDeclare))
                ){
                    this.error(1105, this.name);
                }
                break;
            case 'require' : 
                if( !(this.parentStack && ( this.parentStack.isProgram || this.parentStack.isPackageDeclaration )) ){
                    this.error(1105, this.name);
                }
                this.createRequireModule( this.checkImportParams(args) );
                break;
            case 'import' : 
                if(  !(this.parentStack && ( this.parentStack.isProgram || this.parentStack.isPackageDeclaration )) ){
                    this.error(1105, this.name);
                }
                this.extractDependenceRefs( this.checkImportParams(args) );
                break;
            case 'deprecated' : 
                if( !this.additional || !(this.additional.isMethodDefinition || 
                    this.additional.isPropertyDefinition || 
                    this.additional.isDeclaratorDeclaration || 
                    this.additional.isClassDeclaration)
                ){
                    this.error(1104, this.name);
                }
                break;
            case 'hostcomponent' : 
                if( !args.length || args.length > 1 ){
                    this.error( 1001, 1, args.length );
                }
                const classModule = this.getModuleById( args[0].value )
                if( !classModule ){
                    this.error(1083, args[0].value );
                }
            break;
            case 'post' : 
            case 'get' : 
            case 'del' : 
            case 'put' : 
            case 'option' :
            case 'router' : 
                if( !this.additional || !(this.additional.module.isClass || this.additional.isMethodDefinition)){
                    this.error(1105, this.name);
                }
            break;
            case 'callable' :
            case 'override':
                if( !this.additional || !(this.additional.isMethodDefinition)){
                    this.error(1104, this.name);
                }
            break
            case 'syntax' :
                if( !this.additional || !(this.additional.isPackageDeclaration || 
                    this.additional.isProgram || 
                    this.additional.isInterfaceDeclaration || 
                    this.additional.isDeclaratorDeclaration || 
                    this.additional.isDeclaratorTypeAlias || 
                    this.additional.isDeclaratorFunction || 
                    (this.additional.isEnumDeclaration && !this.additional.isExpressionDeclare) ||
                    this.additional.isClassDeclaration) 
                ){
                    if(!this.parentStack.isProgram){
                        this.error(1103, this.name);
                    }
                }
            break;
            case 'runtime' :
                if( !this.additional || !(this.additional.isPackageDeclaration || 
                    this.additional.isProgram || 
                    this.additional.isInterfaceDeclaration || 
                    this.additional.isDeclaratorDeclaration ||  
                    this.additional.isDeclaratorFunction || 
                    (this.additional.isEnumDeclaration && !this.additional.isExpressionDeclare) ||
                    this.additional.isClassDeclaration) 
                ){
                    if(!this.parentStack.isProgram){
                        this.error(1103, this.name);
                    }
                }
                const value = (args[0].value || '').toLowerCase();
                if( value ==='server'){
                    this.compilation.setPolicy(Constant.POLICY_SERVER, ownerModule);
                }else if( value ==='client' ){
                    this.compilation.setPolicy(Constant.POLICY_CLIENT, ownerModule);
                }else if( value ==='all' ){
                    this.compilation.setPolicy(Constant.POLICY_ALL, ownerModule);
                }else{
                    item.error(1092);
                }
            break;
            case 'embed' :
                if( this.additional && this.additional.module && !(
                    this.additional.isClassDeclaration || 
                    this.additional.isDeclaratorDeclaration || 
                    this.additional.isPropertyDefinition ) 
                ){
                    this.error(1102);
                }
                if( !args.length ){
                    this.error(1101);
                }
                args.forEach( item=>{
                    let file = this.compiler.resolve(item.value, this.file ? path.dirname(this.file) : null);
                    var assign = item.assigned ? item.key : null;
                    var additional = this.additional;
                    if( additional && additional.isPropertyDefinition){
                        var top = additional.module && additional.module.methodConstructor ? 
                                    additional.module.methodConstructor : this.compilation.getStackByModule(additional.module) || additional.compilation;
                        assign = top.scope.generateVarName( additional.id.value() );
                    }
                    if( !file ){
                        file = this.compiler.normalizePath(item.value);
                        item.resolveFile = file;
                    }else{
                        item.resolveFile = this.compiler.normalizePath(file);
                    }

                    if( file ){
                        const target = additional && additional.module || this.compilation;
                        if( !target.addAsset( item.resolveFile, item.value, null, path.extname(file), assign, null, this) ){
                            if( target.file === this.compilation.file ){
                                this.error(1106, item.value );
                            }
                        }
                    }
                    
                });
            break;
            case 'main' :
                if(this.additional){
                    const modifier = this.additional.modifier ? this.additional.modifier.value() : 'public';
                    if( !(modifier === 'public' && this.additional.static && this.additional.isMethodDefinition) ){
                        this.error(1138, this.name);
                    }
                }
            break;
        }
    
    }
}

module.exports = AnnotationDeclaration;