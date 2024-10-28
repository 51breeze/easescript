const fs = require('fs');
const path = require('path');
const Lang = require('./Lang');
const chalk = require('chalk');
const directiveMap={
    "Runtime":true,
    "Syntax":true,
}
const globalShortenTypeMaps={
    "int":true,
    "uint":true,
    "double":true,
    "number":true,
    "float":true,
    "array":true,
    "string":true,
    "boolean":true,
    "regexp":true,
    "object":true,
    "class":true,
    "any":true,
    "null":true,
    "void":true,
    "undefined":true,
    "never":true
};

const scalarTypeMaps = {
    "int":true,
    "uint":true,
    "double":true,
    "number":true,
    "float":true,
    "string":true,
    "boolean":true,
    "regexp":true,
    "null":true,
    "undefined":true,
}

const mergeTypeKey = Symbol('type is merged');
module.exports={
    IS_STACK:Symbol('this is stack'),
    IS_COMPILATION:Symbol('this is compilation'),
    IS_MODULE:Symbol('this is module'),
    IS_TYPE:Symbol('this is type'),
    IS_CONTEXT:Symbol('this is context'),

    isStack(value){
        return value ? !!value[this.IS_STACK] : false;
    },
    isCompilation(value){
        return value ? !!value[this.IS_COMPILATION] : false;
    },
    isModule(value){
        return value ? !!value[this.IS_MODULE] : false;
    },
    isType(value){
        return value ? !!value[this.IS_TYPE] : false;
    },
    isContext(value){
        return value ? !!value[this.IS_CONTEXT] : false;
    },

    checkDirective( name ){
        return directiveMap[name]
    },
    getPropertyModifierName(method){
        return method.modifier ? method.modifier.value() : 'public';
    },
    existsSync(file){
        return fs.existsSync(file);
    },
    getFileStatSync(file){
        return fs.statSync( file )
    },
    readdir(dir, isFull ){
        if( !fs.existsSync(dir) ){
            return null;
        }
        if( !fs.statSync( dir ).isDirectory() ){
            return null
        }
        dir = path.isAbsolute(dir) ? dir : path.resolve(dir)
        var files = fs.readdirSync( dir );
        files = files.filter(function(a){
            return !(a==='.' || a==='..');
        });
        if( isFull ){
            return files.map(function(name){
                return path.join(dir,name);
            });
        }
        return files;
    },

    getStackByName( name ){
        const stacks = this.getStacks();
        return stacks[name] || null;
    },

    isStackByName(target, name, flag ){
        const fn = this.getStackByName( name );
        const result = fn && target instanceof fn;
        return result && flag ? target : result;
    },
    info( msg ){
        console.info( msg );
    },
    log( msg ){
        console.log( msg );
    },
    debug( msg ){
        msg = String(msg);
        const orange = chalk.keyword('orange')
        console.trace( orange('[Debug]')+' '+msg+'\n');
    },
    warn( msg ){
        console.warn(`${Lang.get('warn')} ${chalk.yellow(msg)}\n`);
    },
    error(msg){
        console.error(`${Lang.get('error')} ${chalk.red(msg)}\n`);
    },
    reportDiagnosticMessage(diagno){
        const file = diagno.file;
        const range = diagno.range;
        const kind = diagno.kind;
        const message = diagno.message;
        const code = diagno.code;
        if( kind>=0){
            const lightGray = chalk.rgb(240,240,240);
            const blackGray = chalk.rgb(50,50,50);
            let mes = lightGray(file ? `(${file}:${range.start.line}:${range.start.column}) ${code}` : `${code}`)
            if(kind===0){
                console.error(`${Lang.get('error')} ${blackGray(message)} ${mes}\n`);
            }else if(kind===1){
                console.warn(`${Lang.get('warn')} ${blackGray(message)} ${mes}\n`);
            }else{
                console.info(`${Lang.get('info')} ${blackGray(message)} ${mes}\n`);
            }
        }
    },
    scalarMap:["number","boolean","float","int","uint","double","regexp","string"],  
    isScalar(type){
        return type && !this.isModule(type) && !type.isInstanceofType && (type.isLiteralType || (type.isAliasType && scalarTypeMaps[type.id]===true));
    },
    isTypeModule(type){
        return type && this.isModule(type) && (type.isClass || type.isInterface || type.isStructTable || type.isEnum) === true;
    },
    isWrapType(type){
        return type && 
        this.isType(type) && 
        (type.isTupleType || 
        type.isGenericType || 
        type.isClassGenericType || 
        type.isInstanceofType || 
        type.isCircularType || 
        type.isPredicateType || 
        type.isLiteralType || 
        type.isLiteralObjectType || 
        type.isLiteralArrayType || 
        type.isFunctionType || 
        type.isAliasType) === true;
    },
    isLiteralObjectType(type, flag=false){
        if(!this.isType(type))return false;
        if(type.isTypeofType){
            return this.isLiteralObjectType(type.origin.type())
        }
        if(type.isAliasType || type.isClassGenericType){
            return this.isLiteralObjectType(type.inherit.type())
        }
        if(flag && (type.isTupleType || type.isLiteralArrayType) === true){
            return true;
        }
        return type.isLiteralObjectType === true;
    },
    isLiteralArrayType(type){
        if(!this.isType(type))return false;
        if(type.isTypeofType){
            return this.isLiteralArrayType(type.origin.type())
        }
        if(type.isAliasType || type.isClassGenericType){
            return this.isLiteralArrayType(type.inherit.type())
        }
        return (type.isTupleType || type.isLiteralArrayType) === true;
    },
    isClassType(type){
        if(type && this.isModule(type) && (type.isClass || type.isEnum) ){
            return true;
        }
        return false;
    },
    isLocalModule( module ){
        if(!this.isTypeModule(module))return false;
        const compilation = module.compilation;
        return compilation && compilation.isLocalDocument();
    },
    isGlobalModule(module){
        return module && module.isDeclaratorModule && this.isTypeModule(module);
    },
    isInterface(module){
        return module && module.isInterface && this.isTypeModule(module);
    },
    checkTypeForBoth(left,right, isStrict=true){
        if( left === right ){
            return true;
        }else if( !left || !right ){
            return false;
        }
        if(left.isAnyType){
            return right.isAnyType === true;
        }else if(right.isAnyType){
            return left.isAnyType === true;
        }else if(left.isVoidType || right.isVoidType){
            return left.isVoidType === right.isVoidType;
        }else if(left.isNullableType || right.isNullableType){
            return left.isNullableType === right.isNullableType;
        }else if(left.isUndefinedType || right.isUndefinedType){
            return left.isUndefinedType === right.isUndefinedType;
        }
        else if(left.isLiteralObjectType){
            if(!right.isLiteralObjectType)return false;
            if(left.attributes.size !== right.attributes.size)return false;
            let lD = left.dynamicProperties;
            let rD = right.dynamicProperties;
            if(Boolean(lD) !== Boolean(rD))return false;
            if(lD && rD){
                if(lD.size !== rD.size)return false;
                if(Array.from(lD.keys()).some( key=> !rD.has(key) )){
                    return false;
                }
            }
            return left.check( right );
        }
        else if(left.isLiteralArrayType){
            if(!right.isLiteralArrayType)return false;
            if(left.elements.length !== right.elements.length)return false;
            return left.check( right );
        }else if(left.isTupleType){
            if(!right.isTupleType)return false;
            if(left.prefix !== right.prefix)return false;
            if(left.isTupleUnion !== right.isTupleUnion)return false;
            if(left.rest !== right.rest)return false;
            if(left.requireCount !== right.requireCount)return false;
            return left.check( right );
        }
        else if(
            left.isLiteralType || 
            left.isEnumType || 
            left.isClassType ||
            left.isVoidType ||
            left.isUnknownType ||
            left.isNullableType ||
            left.isNeverType){
                if(!isStrict && left.isLiteralType){
                    return right.check(left)
                }
            return left.check( right );
        }else if(left.isFunctionType){
            if( !right.isFunctionType )return false;
            const lParams = left.params;
            const rParams = right.params;
            if(lParams.length !== rParams.length)return false;
            const lReturnType = left.inferReturnType();
            const rReturnType = right.inferReturnType();
            if(lReturnType && !rReturnType)return false;
            if(!lReturnType && rReturnType)return false;
            if(!this.checkTypeForBoth(lReturnType, rReturnType, isStrict))return false;
            return lParams.every( (item,index)=>{
                let rItem = rParams[index];
                if(!rItem)return false;
                if(item.isRestElement !== rItem.isRestElement){
                    return false;
                }
                const lType = item.type();
                if(!isStrict && lType.isTupleType && lType.rest){
                    return true;
                }
                return this.checkTypeForBoth(lType, rItem.type(),isStrict);
            });
        }else if( left.isUnionType ){
            if( !right.isUnionType )return false;
            return left.elements.every( (item,index)=>{
                if(!right.elements[index])return false;
                return this.checkTypeForBoth(item.type(), right.elements[index].type(),isStrict);
            });
        }else if( left.isTupleType ){
            if( !right.isTupleType || left.prefix !== right.prefix || left.isTupleUnion !== right.isTupleUnion )return false;
            return left.elements.every( (item,index)=>{
                if(!right.elements[index])return false;
                return this.checkTypeForBoth(item.type(), right.elements[index].type(),isStrict);
            });
        }else if(left.isInstanceofType){
            if(left.isThisType){
                return left.isThisType === right.isThisType
            }
            if( !right.isInstanceofType || left.isThisType !== right.isThisType || left.generics.length !== right.generics.length )return false;
            if(this.checkTypeForBoth(left.inherit.type(), right.inherit.type(),isStrict)){
                return left.generics.every( (item,index)=>{
                    if(!right.generics[index])return false;
                    return this.checkTypeForBoth(item.type(), right.generics[index].type(),isStrict);
                });
            }
            return false;
        }else if(left.isClassGenericType){
            if( !right.isClassGenericType || left.isClassType !== right.isClassType || left.isThisType !== right.isThisType )return false;
            if(left.types.length !== right.types.length)return false;
            if(this.checkTypeForBoth(left.inherit.type(), right.inherit.type(),isStrict)){
                return left.elements.every((item,index)=>{
                    if(!right.elements[index])return false;
                    return this.checkTypeForBoth(item.type(),right.elements[index].type(),isStrict);
                });
            }
            return false;
        }else if( left.isIntersectionType ){
            if(!right.isIntersectionType)return false;
            return this.checkTypeForBoth(left.left.type(), right.left.type(),isStrict) && this.checkTypeForBoth(left.right.type(), right.right.type(),isStrict);
        }else if( left.isAliasType ){
            if(!right.isAliasType)return false;
            return this.checkTypeForBoth(left.inherit.type(),right.inherit.type(),isStrict);
        }else if( left.isKeyofType ){
            if( !right.isKeyofType)return false;
            return this.checkTypeForBoth(left.referenceType.type(),right.referenceType.type(),isStrict);    
        }else if( left.isGenericType ){
            if(!right.isGenericType || left.hasConstraint !== right.hasConstraint )return false;
            if(left.hasConstraint){
                return this.checkTypeForBoth(left.inherit.type(),right.inherit.type(),isStrict);
            }
            return true;
        }else if(left.isTypeofType){
            if(!right.isTypeofType)return false;
            return this.checkTypeForBoth(left.origin.type(),right.origin.type(),isStrict);
        }   
        return left.id === right.id && left.namesapce === right.namesapce;
    },

    isArray(type){
        return type && type.id ==="Array" && type.isDeclaratorModule && this.isModule(type) && type.isClass;
    },
    isObject(type){
        return type && type.id ==="Object" && type.isDeclaratorModule && this.isModule(type) && type.isClass;
    },
    isFunction( stack ){
        if(!stack || !stack.isStack )return false;
        if( stack.isCallExpression || stack.isAccessor ){
            return false;
        }
        if( stack.isProperty && stack.init ){
            stack = stack.init;
        }
        if( stack.isFunctionExpression || stack.isMethodDefinition || stack.isTypeFunctionDefinition){
            return true; 
        }
        return false;
    },
    firstToUpper(name){
        return name.substr(0,1).toUpperCase()+name.substr(1);
    },
    checkDepend(module, depModule){
        if(!module || !depModule )return false;
        if(!this.isModule(module) || !this.isModule(depModule))return false;
        if(module === depModule)return true;
        if(depModule.inherit){
            return this.checkDepend(module, depModule.inherit.type());
        }
        const stacks = depModule.getStacks(true);
        for(let i=0; i<stacks.length;i++){
            const classStack = stacks[i];
            if(!classStack || classStack.compilation.isDestroyed){
                continue;
            }
            const inherit = classStack.inherit;
            if(inherit){
                const inheritModule = classStack.getReferenceModuleType();
                if(inheritModule){
                    return this.checkDepend(module, inheritModule);
                }
            }
        }
        return false;
    },
    getShortType(type){
        if(!type)return type;
        if(type.isTypeofType){
            return this.getShortType(type.origin.type());
        }else if(type.isAliasType){
            return this.getShortType(type.inherit.type());
        }
        return type;
    },
    getOriginType(type, exclude=null){
        if(!this.isType(type))return type;
        if(type.isTypeofType){
            return this.getOriginType(type.origin.type());
        }
        if( type.isClassGenericType && type.isClassType ){
            type = type.types[0];
        }
        while(this.isWrapType(type) && type.extends && type.extends[0]){
            if(exclude){
                if(exclude === type)break;
                if(typeof exclude === 'function' && exclude(type))break;
            }
            type = type.extends[0];
        }
        return type && this.isModule(type) ? type.type() : type;
    },
    getFunctionType(type){
        if(!type)return type;
        if(type.isFunctionType)return type;
        if(type.isAliasType){
            return this.getFunctionType(type.inherit.type())
        }else if(type.isUnionType){
            return type.elements.find(el=>!!this.getFunctionType(el.type()).isFunctionType)
        }
        return type;
    },
    toTypeUniqueArray( array ){
        const data = new Set();
        const items = [];
        array.forEach( value=>{
            const key = value.type().toString();
            if( !data.has(key) ){
                data.add(key);
                items.push( value )
            }
        });
        return items;
    },
    toTypeString(type, inference){
        return this.inferTypeValue(type,inference).toString();
    },
    inferTypeValue(type, inference){
        if(!type)return type;
        type = type.hasGenericType ? type.clone( inference ) : type;
        if( type.isComputeType ){
            type = type.getComputeType().clone( inference );
        }
        return type;
    },
    isModifierPublic( stack ){
        return this.getModifierValue(stack) ==='public';
    },
    isModifierProtected( stack ){
        return stack && stack.isStack && stack.modifier && stack.modifier.value()==='protected';
    },
    isModifierPrivate( stack ){
        return stack && stack.isStack && stack.modifier && stack.modifier.value()==='private';
    },
    getModifierValue( stack ){
        if( stack && stack.isStack ){
            if( stack.modifier ){
                return stack.modifier.value();
            }else if( stack.isMethodDefinition || stack.isPropertyDefinition || stack.isClassDeclaration || 
                stack.isInterfaceDeclaration || (stack.isEnumDeclaration && !stack.isExpressionDeclare) ){
                return 'public';
            }
        }
        return null;
    },

    isIterableIteratorType( type , iteratorType ){
        if( !type || type.isAnyType)return false;
        if( type === iteratorType)return true;
        if( iteratorType && iteratorType.isModule && iteratorType.is(type) ){
            return type.isInstanceofType || this.getOriginType(type) === iteratorType;
        }
        type = this.getOriginType(type);
        return type.isModule && type.getName() ==='Iterator' && type.isDeclaratorModule;
    },

    isStaticDescriptor(desc){
        if(!desc)return false;
        const module = (desc.isStack ? desc.module : desc) || desc;
        if( this.isClassType(module) && module.static ){
           return true;
        }
        if( !(desc.isMethodDefinition || desc.isPropertyDefinition) )return false;
        return !!(desc.static);
    },

    extractFunTypeFromType(type, ctx=null, assigmentGenerics=null, declareGenerics=null){
        if(!type)return null;
        if( type.isFunctionType ){
            return [type, ctx, assigmentGenerics, declareGenerics || type.generics];
        }else if( type.isAliasType ){
            return this.extractFunTypeFromType(type.inherit.type(), ctx, assigmentGenerics, declareGenerics);
        }else if( type.isClassGenericType ){
            const inherit = type.inherit.type();
            if( inherit.isAliasType ){
                if( inherit.target.isDeclaratorTypeAlias && inherit.target.genericity ){
                    const declareGenerics = inherit.target.genericity.elements;
                    if( declareGenerics && declareGenerics.length > 0 ){
                        const target = inherit.inherit.type();
                        if( type.elements.length === 1 ){
                            if( target === declareGenerics[0].type() ){
                                return this.extractFunTypeFromType(type.elements[0].type(), ctx, assigmentGenerics, declareGenerics);
                            }
                        }
                        // ctx = ctx || inherit.target.newContext();
                        // declareGenerics.forEach( (decl, index)=>{
                        //     const value = type.elements[index];
                        //     if( value ){
                        //         ctx.extractive(decl.type(), value.type())
                        //     }
                        // });
                        return this.extractFunTypeFromType(target, ctx, assigmentGenerics || type.types, declareGenerics);
                    }
                }
                return this.extractFunTypeFromType(inherit, ctx, assigmentGenerics || type.types, declareGenerics);
            }
        }else if( type.isUnionType ){
            for(let el of type.elements ){
                const res = this.extractFunTypeFromType(el.type(), ctx, assigmentGenerics, declareGenerics);
                if( res ){
                    return res;
                }
            }
        }else if( type.isIntersectionType ){
            return this.extractFunTypeFromType(type.left.type(), ctx, assigmentGenerics, declareGenerics) || 
            this.extractFunTypeFromType(type.right.type(), ctx, assigmentGenerics, declareGenerics)
        }
        return null;
    },

    isGlobalShortenType(type){
        if(type && (type.isAliasType || type.isVoidType || type.isUnknownType || type.isUndefinedType || type.isNullableType || type.isNeverType || type.isAnyType)){
            return globalShortenTypeMaps[type.id] === true;
        }
        return false;
    },

    isGlobalTypeName(name){
        return globalShortenTypeMaps[name]
    },

    setMergedType(type){
        if(type){
            type[mergeTypeKey] = true;
        }
        return type;
    },
    isMergedType(type){
        if(!type)return false;
        if(type.isTypeofType && type.origin){
            return this.isMergedType(type.origin.type());
        }
        return type[mergeTypeKey] === true;
    },
    isNullType(type){
        if(!type)return false;
        return type.isNullableType || type.isUndefinedType || type.isVoidType;
    },
    inferNotNullType(type){
        const infer = (type)=>{
            if(!type)return null;
            if(type.isTypeofType)return infer(type.origin.type())
            if(type.isAliasType)return infer(type.inherit.type())
            if(type.isUnionType){
                const els = type.elements.filter(el=>!this.isNullType(el.type()));
                return els.length === 1 ? els[0].type() : null;
            }
        }
        return infer(type) || type;
    },
    incrementCharacter(value){
        if(typeof value ==='number'){
            return value+1
        }else if(typeof value ==='string'){
            const regexp = /(\d+[\.\d+]?|[a-zA-Z]+)$/;
            if(!regexp.test(value)){
                return false;
            }
            return value.replace(regexp,(value)=>{
                let code = value.charCodeAt(value.length-1);
                if( code >= 48 && code <= 57){
                    return parseFloat(value) + 1
                }else{
                    let carry = code===90 || code===122;
                    if(carry){
                        let words = value.split('')
                        let len = words.length-1;
                        words[len] = code===90 ? 'A' : 'a';
                        while(len>0){
                            code = value.charCodeAt(--len);
                            carry = code===90 || code===122
                            if(carry){
                                words[len] = code===90 ? 'A' : 'a';
                            }else{
                                words[len] = String.fromCharCode(code+1);
                                break;
                            }
                        }
                        if(carry){
                            words.unshift(code===90 ? 'A' : 'a')
                        }
                        return words.join('');
                    }else{
                        return value.substring(0, value.length-1)+String.fromCharCode(code+1)
                    }
                } 
            })
        }
        return false;
    },
    normalizePath( file ){
        if(!file)return file;
        if(file.includes('\\')){
            return path.sep === "\\" ? file.replace(/\\/g, "/") : file;
        }
        return file;
    }
}