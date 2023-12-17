const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const directiveMap={
    "Runtime":true,
    "Syntax":true,
}

module.exports={
    checkDirective( name ){
        return directiveMap[name]
    },
    getPropertyModifierName(method){
        return method.modifier ? method.modifier.value() : 'public';
    },
    existsSync(pathName){
        return fs.existsSync(pathName);
    },
    getFileStatSync(pathName){
        return fs.statSync( pathName )
    },
    readdir(pathName, isFull ){
        if( !fs.existsSync(pathName) ){
            return null;
        }
        if( !fs.statSync( pathName ).isDirectory() ){
            return null
        }
        var files = fs.readdirSync( pathName );
        files = files.filter(function(a){
            return !(a==='.' || a==='..');
        });
        if( isFull ){
            return files.map(function(name){
                return path.join(pathName,name);
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
        if( msg.startsWith('[Error]') ){
            msg = chalk.red(msg);
        }else if(msg.startsWith('[Warn]') ){
            msg = chalk.yellow(msg);
        }
        console.trace( msg );
    },
    warn( msg ){
        console.warn( chalk.yellow(msg) );
    },
    error( msg ){
        console.error( chalk.red(msg) );
    },
    scalarMap:["number","boolean","float","int","uint","double","regexp","string"],  
    isScalar(type){
        return type && !type.isModule && !type.isInstanceofType && (type.isLiteralType || (type.isAliasType && this.scalarMap.includes( type.toString() )));
    },
    isTypeModule(type){
        return type && type.isModule && (type.isClass || type.isInterface || type.isEnum) === true;
    },
    isWrapType(type){
        return type && 
        type.isType && 
        (type.isTupleType || 
        type.isGenericType || 
        type.isClassGenericType || 
        type.isInstanceofType || 
        type.isLiteralType || 
        type.isLiteralObjectType || 
        type.isLiteralArrayType || 
        type.isFunctionType || 
        type.isAliasType) === true;
    },
    isLiteralObjectType(type){
        return type && type.isType && (type.isTupleType || type.isLiteralObjectType || type.isLiteralArrayType) === true;
    },
    isClassType(type){
        if(type && type.isType && type.isModule && (type.isClass || type.isEnum) ){
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
        if( left.isLiteralObjectType || 
            left.isLiteralType || 
            left.isLiteralArrayType || 
            left.isEnumType || 
            left.isClassType || 
            left.isAnyType || 
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
                const lType = item.type();
                if(!isStrict && lType.isTupleType && lType.rest){
                    return true;
                }
                if(!rParams[index])return false;
                return this.checkTypeForBoth(lType, rParams[index].type(),isStrict);
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
        }
        return left.id === right.id && left.namesapce === right.namesapce;
    },

    isArray(type){
        return type && type.id ==="Array" && type.isDeclaratorModule && type.isModule && type.isClass;
    },
    isObject(type){
        return type && type.id ==="Object" && type.isDeclaratorModule && type.isModule && type.isClass;
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
        const check = (module, depModule)=>{
            if(!module || !depModule )return false;
            if(!module.isModule || !depModule.isModule)return false;
            const classStack = depModule.moduleStack;
            const inherit = classStack && classStack.inherit;
            if( inherit ){
                const inheritModule = classStack.getModuleById( inherit.value() );
                if( inheritModule === module ){
                    return true;
                }
                return check(module, inheritModule);
            }
            return false;
        }
        return check(module, depModule) && check(depModule,module);
    },
    getOriginType(type){
        if(!type)return type;
        if( type.isClassGenericType && type.isClassType ){
            type = type.types[0];
        }
        while( this.isWrapType(type) && type.extends && type.extends[0] ){
            type = type.extends[0];
        }
        return type && type.isModule ? type.type() : type;
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
        return !!desc.static;
    },

    extractFunTypeFromType(type, ctx){
        if(!type)return null;
        if( type.isFunctionType ){
            return [type, ctx];
        }else if( type.isAliasType ){
            return this.extractFunTypeFromType(type.inherit.type(), ctx);
        }else if( type.isClassGenericType ){
            const inherit = type.inherit.type();
            if( inherit.isAliasType ){
                if( inherit.target.isDeclaratorTypeAlias && inherit.target.genericity ){
                    const declareGenerics = inherit.target.genericity.elements;
                    if( declareGenerics && declareGenerics.length > 0 ){
                        const target = inherit.inherit.type();
                        if( type.elements.length === 1 ){
                            if( target === declareGenerics[0].type() ){
                                return this.extractFunTypeFromType(type.elements[0].type(), ctx);
                            }
                        }
                        ctx = ctx || inherit.target.newContext();
                        declareGenerics.forEach( (decl, index)=>{
                            const value = type.elements[index];
                            if( value ){
                                ctx.extractive(decl.type(), value.type())
                            }
                        });
                        return this.extractFunTypeFromType(target, ctx);
                    }
                }
                return this.extractFunTypeFromType(inherit, ctx);
            }
        }else if( type.isUnionType ){
            for(let el of type.elements ){
                const res = this.extractFunTypeFromType(el.type(), ctx);
                if( res ){
                    return res;
                }
            }
        }else if( type.isIntersectionType ){
            return this.extractFunTypeFromType(type.left.type(), ctx) || this.extractFunTypeFromType(type.right.type(), ctx)
        }
        return null;
    }

}