const Utils = require('../lib/core/Utils');
const Namespace = require('../lib/core/Namespace');
const Context = require('../lib/core/Context');
const fs = require('fs');
const path = require('path');
function makeRawType(type, defaultType='any', inferFlag = false, colon=': '){
    if(!type)return colon+defaultType;
    let onlyTypeName = inferFlag;
    if(type.isStack && type.parentStack){
        let p = type.parentStack;
        if(p.parentStack){
            if(p.isDeclarator){
                p = p.parentStack
            }else if(p.isObjectPattern || p.isArrayPattern){
                p = p.parentStack
            }else if(p.isTypeDefinitionStack(p)){
                p = p.parentStack;
            }
            if(p.isObjectPattern || p.isArrayPattern){
                p = p.parentStack; 
            }
        }
        if(p.isFunctionExpression){
            onlyTypeName = true;
        }
    }

    if(inferFlag){
        if(type.type.isGenericType){
            return type.type.toString({},{onlyTypeName});
        }
    }

    Context.setDefaultInferType(Namespace.globals.get('any'))
    const str =  colon+ type.type().toString({}, {
        complete:true,
        onlyTypeName,
        inbuild:true,
        fetchDeclareGenericsDefaultValue:true,
        inferAnyDefaultType:true,
    });
    Context.setDefaultInferType(null);
    return str
}

function makeFunctionParams(params){
    return params.map( item=>{
        if( item.isObjectPattern ){
            const properties = item.properties.map( property=>{
                const name = property.key.value();
                const init = property.init;
                if( init && init.isAssignmentPattern ){
                    return `${init.left.value()} = ${init.right.raw()}`;
                }
                return `${name}`;
            });
            
            const acceptType = item.acceptType ? makeRawType(item.acceptType) : '';
            if(acceptType)return `{${properties.join(',')}}${acceptType}`;
            return `{${properties.join(',')}}`;
        }else if( item.isArrayPattern ){
            const properties = item.elements.map( property=>{
                if( property.isAssignmentPattern ){
                    return `${property.left.value()}= ${property.right.raw()}`;
                }
                const name = property.value();
                return `${name}`;
            });
            const acceptType = item.acceptType ? makeRawType(item.acceptType) : '';
            if(acceptType)return `[${properties.join(',')}]${acceptType}`;
            return `[${properties.join(',')}]`;
        }else{
            const name = item.value();
            const type = makeRawType(item.acceptType);
            const rest = item.isRestElement ? '...' : '';
            const question = item.question ? '?' : '';
            if( item.isAssignmentPattern && item.right ){
                const initial = item.right.value();
                return `${rest}${name}${question}${type}=${initial}`;
            }
            return `${rest}${name}${question}${type}`;
        }
    }).join(', ')
}

function makeDefinitionType(stack){
    if(stack.isTypeUnionDefinition){
        return stack.elements.map(item=>makeDefinitionType(item)).join(' | ')
    }else if(stack.isTypeIntersectionDefinition ){
        return [stack.left, stack.right].map(item=>makeDefinitionType(item)).join(' & ');
    }else if( stack.isTypeObjectDefinition ){
        const properties = stack.properties.map( property=>makeDefinitionType(property));
        return `{${properties.join(',')}}`;
    }else if(stack.isTypeObjectPropertyDefinition){
        const key = stack.key.value();
        const question = stack.question ? '?' : '';
        const init = makeDefinitionType(stack.init);
        return `${key}${question}: ${init}`;
    }else if(stack.isTypeTupleDefinition){
        const prefix = stack.prefix;
        const els = stack.elements.map( item=>makeDefinitionType(item) ).join(', ');
        return prefix ? `${els}[]` : `[${els}]`;
    }
    else{
        return stack.value();
    }
    
}

function makeGenericity(genericity){
    if(!genericity || !genericity.elements.length)return '';
    const genericElements = genericity.elements.map( item=>{
        if( item.isGenericTypeAssignmentDeclaration ){
            return `${item.left.value()} = ${makeDefinitionType(item.right)}`;
        }
        if(item.extends){
            return `${item.valueType.value()} extends ${item.extends.raw()}`
        }
        return item.valueType.value();
    })
    return `<${genericElements.join(', ')}>`;
}

function makeAssignGenerics(assignGenerics){
    if(!assignGenerics || !assignGenerics.length)return ''
    const value = assignGenerics.map(item=>item.value()).join(', ');
    return `<${value}>`;
}

function formatIndent(message, indent='\t'){
    return message.replace(/(\t+)/g,(a,b)=>{
        return b+indent;
    }).replace(/[\r\n]}/g,`\n${indent}}`);
}

function makeFunction(stack, typeWhenExists=false){
    const genericity = makeGenericity(stack.genericity);
    let returnType = '';
    if(typeWhenExists){
        if(stack._returnType){
            returnType = makeRawType(stack._returnType, 'any', true);
        }
    }else{
        returnType = makeRawType(stack._returnType || stack.getReturnedType(), 'void', true);
    }
    return formatIndent(`${genericity}(${makeFunctionParams(stack.params)})${returnType}`,'\t\t');
}

function makeComments(comments, descriptor, indent='\t\t'){
    descriptor = descriptor.replace(/^[\s\t]+/,'');
    if(!comments || !comments.length)return indent+descriptor;
    if(comments){
        const text = comments.map(item=>{
            if(item.type==='Block'){
                let value = item.value.replace(/([\r\n]+)([\s\t]+)?/g, `$1${indent}`);
                return `/*${value}*/`
            }else{
                return `//${item.value}`;
            }
        }).join(`\n${indent}`);
        return `${indent}${text.replace(/^[\r\n\s\t]+/,'')}\n${indent}${descriptor.replace(/^[\s\t]+/,'')}`;
    }
}

function makeMethod(stack, isConstructor, indent='\t\t'){
    if(!stack.isMethodDefinition)return null;
    const modifier = Utils.getModifierValue(stack)
    if(modifier==='private')return null;
    let method = [];
    let key = stack.dynamicMethod ? `[${stack.key.value()}${makeRawType(stack.dynamicType.type())}]` : stack.key.value();
    if(stack.static){
        method.push('static ')
    }
    if(modifier==='protected'){
        method.push(`protected `)
    }
    if(stack.isMethodGetterDefinition){
        method.push('get ')
    }else if(stack.isMethodSetterDefinition){
        method.push('set ')
    }
    method.push(`${key}`)
    method.push(makeFunction(stack.expression, isConstructor))
    return makeComments(stack.comments, method.join(''), indent);
}

function makeProperty(stack, indent='\t\t'){
    if(!stack.isPropertyDefinition)return null;
    const modifier = Utils.getModifierValue(stack)
    if(modifier==='private')return null;
    let property = [];
    let key = stack.dynamic ? `[${stack.value()}${makeRawType(stack.dynamicKeyType)}]` : stack.value();
    if(stack.static){
        property.push('static ')
    }
    if(modifier==='protected'){
        property.push(`protected `)
    }
    if(stack.isReadonly){
        property.push(`const `)
    }

    const type = makeRawType(stack.type());
    const init = stack.init;
    if(init && init.isLiteral){
        property.push(`${key}${type}=${init.raw()}`)
    }else{
        property.push(`${key}${type}`)
    }
    return makeComments(stack.comments, property.join(''), indent);
}

function makeDeclarator(stack){
    if(stack.isDeclaratorTypeAlias){
        let id = stack.left.value()
        let value = formatIndent(makeRawType(stack.right, 'any', false, ''));
        let genericity = formatIndent(makeGenericity(stack.genericity))
        return `declare type ${id}${genericity} = ${value};`
    }else if(stack.isDeclaratorVariable){
        stack = stack.declarations[0];
        let id = stack.id.value()
        let init = stack.init;
        let kind = stack.kind;
        let type = formatIndent(makeRawType(stack._acceptType, makeRawType(init,'any'), false));
        let initValue = '';
        if(init && (init.isIdentifier||init.isLiteral)){
            initValue = ' = '+init.raw();
        }
        return `declare ${kind} ${id}${type}${initValue};`;
    }
    return null;
}

function makeImport(stack, module, dependencies, cache=null){
    if(stack.source.isLiteral)return null;
    const desc = stack.description();
    if(!desc)return null;
    if(desc.namespace === module.namespace)return null;
    if(!module.dependencies.has(desc)){
        return null;
    }
    if(!dependencies.has(desc))return null;
    if(cache.has(desc))return null;
    cache.add(desc);
    const alias = stack.alias;
    if(alias){
        return `import ${stack.raw()} as ${alias.value()};`
    }else{
        return `import ${stack.raw()};`
    }
    // if(stack.specifiers.length>0){
    //     let specifiers = [];
    //     let defaultSpecifier =  null;
    //     let namespaceSpecifier =  null;
    //     stack.specifiers.forEach( spec=>{
    //         let local = spec.value();
    //         if(spec.isImportDefaultSpecifier){
    //             defaultSpecifier = local;
    //             return;
    //         }
    //         if(spec.isImportNamespaceSpecifier){
    //             namespaceSpecifier = `* as ${local}`;
    //             return;
    //         }
    //         let imported = spec.imported.value();
    //         if(local !== imported){
    //             specifiers.push(`${imported} as ${local}`);
    //         }else{
    //             specifiers.push(local);
    //         }
    //     });
    //     if(defaultSpecifier){
    //         if(specifiers.length>0){
    //             return `import ${defaultSpecifier}, {${specifiers.join(',')}} from "${stack.value()}";`;
    //         }else{
    //             return `import ${defaultSpecifier} from "${stack.value()}";`
    //         }
    //     }else if(specifiers.length>0){
    //         return `import {${specifiers.join(',')}} from "${stack.value()}";`
    //     }
    //     else if(namespaceSpecifier){
    //         return `import ${namespaceSpecifier} from "${stack.value()}";`
    //     }else{
    //         return `import {${specifiers.join(',')}} from "${stack.value()}";`
    //     }
    // }else{
    //     return `import ${stack.raw()};`
    // }
}


function findInheritMethods(module, stack, name){
    if(!module || !module.isModule)return false;
    return module.extends.concat(module.implements).some( dep=>{
        if(!dep || !dep.isModule)return false;
        const descriptors = dep.descriptors.get(name);
        if(descriptors){
            const has = descriptors.some( desc=>{
                if(stack.isMethodGetterDefinition && desc.isMethodGetterDefinition){
                    return true;
                }else if(stack.isMethodSetterDefinition && desc.isMethodSetterDefinition){
                    return true;
                }else if(stack.isMethodDefinition && desc.isMethodDefinition){
                    return true;
                }
                return false;
            });
            if(has){
                return true;
            }
        }
        return findInheritMethods(dep, name);
    });
}

function genImports(imports, module, dependencies){
    const cache = new WeakSet();
    return imports.map( imp=>makeImport(imp, module, dependencies, cache) ).filter(item=>!!item);
}

function getDependencyType(type,dataset){
    if(!type||!type.isType)return;
    if(type.isModule){
        dataset.add(type);
    }else if(type.isClassGenericType || type.isTupleType || type.isUnionType){
        type.elements.forEach(item=>{
            getDependencyType(item.type(), dataset);
        });
        if(type.isClassGenericType && (type=type.inherit) ){
            type = type.type()
            if(type.isAliasType){
                getDependencyType(type, dataset);
            }
        }
    }else if(type.isAliasType){
        if(type.target && type.target.isStack && type.target.compilation){
            if(!type.target.compilation.isGlobalDocument()){
                dataset.add(type.target);
            }
        }
        if(type = type.inherit){
            getDependencyType(type.type(), dataset);
        }
    }else if(type.isIntersectionType){
        getDependencyType(type.left.type(), dataset);
        getDependencyType(type.right.type(), dataset);
    }else if(type.isKeyofType && (type=type.referenceType)){
        getDependencyType(type.type(), dataset);
    }else if(type.isFunctionType){
        if(type.target && type.target.isDeclaratorFunction && type.target.compilation){
            if(!type.target.compilation.isGlobalDocument()){
                dataset.add(type.target);
            }
        }
        type.params.forEach(item=>{
            if(item.acceptType){
                getDependencyType(item.acceptType.type(),dataset)
            }
        });
        const acceptType = type.getInferReturnType();
        if(acceptType){
            getDependencyType(acceptType, dataset);
        }
        let genericity = type.target && type.target.genericity;
        if( genericity ){
            genericity.elements.forEach( item=>getDependencyType(item.type(),dataset) );
        }
    }else if(type.isGenericType && type.hasConstraint){
        getDependencyType(type.inherit.type(),dataset);
    }
}

function addDeclaratorVariableRefs(stack, dataset){
    if(stack && stack.isAssignmentPattern && stack.right && stack.right.isIdentifier){
        const desc = stack.right.description();
        if(desc && desc.isDeclaratorVariable && !desc.compilation.isGlobalDocument()){
            dataset.add(desc)
        }
    }
}

function getDependencies(stack, dataset){
    if(!stack || !dataset)return;
    if(stack.isEnumDeclaration || stack.isClassDeclaration || stack.isDeclaratorDeclaration || stack.isInterfaceDeclaration){
        //isStructTableDeclaration
    }else if(stack.isMethodDefinition){
        stack = stack.expression;
        stack.params.forEach(item=>{
            if( item.isObjectPattern ){
                item.properties.map( property=>{
                    addDeclaratorVariableRefs(property.init,dataset);
                });
            }else if( item.isArrayPattern ){
                item.elements.map( item=>{
                    addDeclaratorVariableRefs(item,dataset);
                });
            }else{
                addDeclaratorVariableRefs(item,dataset);
            }
            if(item.acceptType){
                getDependencyType(item.acceptType.type(),dataset)
            }
        });
        const acceptType = stack.getReturnedType();
        if(acceptType){
            getDependencyType(acceptType, dataset)
        }

        let genericity = stack.genericity;
        if( genericity ){
            genericity.elements.forEach( item=>getDependencyType(item.type(),dataset) );
        }

    }else if(stack.isPropertyDefinition){
        getDependencyType(stack.type(), dataset)
    }
}

function sortMembers( bodys ){
    return bodys.sort( (a,b)=>{
        let a1 = a[1].static ? -5 : 0;
        let b1 = b[1].static ? -5 : 0;
        if(a1===0){
            const modifier = Utils.getModifierValue(a[1]);
            if(modifier==='protected'){
                a1 = -4
            }
        }
        if(b1===0){
            const modifier = Utils.getModifierValue(b[1]);
            if(modifier==='protected'){
                b1 = -4
            }
        }
        if(a1===0 && a[1].isConstructor ){
            a1 = -3
        }
        if(b1===0 && b[1].isConstructor){
            b1 = -3
        }
        if(a1===0 && a[1].isPropertyDefinition ){
            a1 = -2
        }
        if(b1===0 && b[1].isPropertyDefinition){
            b1 = -2
        }
        if(a1===0 && (a[1].isMethodGetterDefinition || a[1].isMethodSetterDefinition) ){
            a1 = -1
        }
        if(b1===0 && (b[1].isMethodGetterDefinition || b[1].isMethodSetterDefinition) ){
            b1 = -1
        }
        return a1 - b1;
    });
}

function makeDefineSlotAnnotation(module){
    const slots = module.jsxDeclaredSlots;
    if(!slots)return;
    const items = [];
    slots.forEach((jsx,key)=>{
        const args = jsx.openingElement.attributes.map( attr=>{
            const key = attr.name.value();
            const type =  attr.value ? makeRawType(attr.value) : null;
            return type ? key+type : key;
        });
        if(args.length>0){
            items.push(`@Define(slot, ${key}, ${args.join(', ')});`)
        }else{
            items.push(`@Define(slot, ${key});`)
        }
    });
    return items;
}

function makeModule(module, globals, emitFile){
    if(!module.used)return;
    if(!module.isModule)return;

    const id = module.id
    const kind = module.isClass ? 'class' : 'interface';
    const stacks = module.getStacks();
    const dependencies = new Set();
    const stackGenericity = stacks.filter(stack=>!!stack.genericity).sort((a,b)=>{
        if(a.genericity.elements.length > b.genericity.elements.length)return -1;
        if(b.genericity.elements.length > a.genericity.elements.length)return 1;
        return 0;
    })[0];

    let inherit = '';
    let implements = '';
    let genericity = stackGenericity ? makeGenericity(stackGenericity.genericity) : '';
    let stackExtends = stacks.filter(stack=>!!stack.inherit)[0];
    if(stackExtends){
        dependencies.add(module.inherit.type())
        inherit = `extends ${stackExtends.inherit.value()}${makeAssignGenerics(stackExtends.inherit.assignGenerics)}`
    }

    let stackImplements = stacks.filter(stack=>stack.implements && stack.implements.length>0).sort((a,b)=>{
        if(a.implements.length > b.implements.length)return -1;
        if(b.implements.length > a.implements.length)return 1;
        return 0;
    });

    if(stackImplements.length>0){
        module.implements.forEach( dep=>{
            dependencies.add(dep)
        });
        const imps = stackImplements[0].implements.map( imp=>{
            return `${imp.value()}${makeAssignGenerics(imp.assignGenerics)}`
        }).filter( imps=>!!imps )
        implements = ` implements ${imps.join(', ')}`;
    }
    
    const contents = [];
    const bodys = [];
    const usings = [];
    const memmbers = Object.create(null);
    const defineSlots = makeDefineSlotAnnotation(module);
    if(defineSlots){
        contents.push( ...defineSlots );
    }

    contents.push(`\tdeclare ${kind} ${id}${genericity} ${inherit}${implements}{`);

    stacks.forEach( stack=>{
        if(stack.isEnumDeclaration){
            return;
        }

        if(stack.usings && (stack.isDeclaratorDeclaration || stack.isClassDeclaration) ){
            stack.usings.forEach(stack=>{
                if(stack.isUseStatement){
                    const _keywords = stack.keywords.map( key=>key.raw() );
                    const _extends = stack.extends.map( key=>key.raw() );
                    const _body = sortMembers(stack.body.map( stack=>{
                        if(stack.isMethodDefinition){
                            getDependencies(stack, dependencies);
                            const result = makeMethod(stack, stack.isConstructor, '\t\t\t');
                            if(result){
                                return [result, stack]
                            }
                        }else if(stack.isPropertyDefinition){
                            getDependencies(stack, dependencies);
                            const result = makeProperty(stack, '\t\t\t');
                            if(result){
                               return [result,stack]
                            }
                        }
                    }).filter(Boolean)).map(item=>item[0]);
                    if(_extends.length>0){
                        usings.push(`\t\tuse ${_keywords.join(', ')} extends ${_extends.join(', ')}{\n${_body.join('\n')}\n\t\t}`);
                    }else{
                        usings.push(`\t\tuse ${_keywords.join(', ')}{\n${_body.join('\n')}\n\t\t}`);
                    }
                }
            })
        }

        stack.body.forEach( stack=>{
            let descriptors = memmbers[stack.value()] || (memmbers[stack.value()]=[]);
            descriptors.push(stack);
            if(descriptors.length>1){
                const result = descriptors.every( descriptor=>{
                    const has = descriptors.some( item=>{
                        if(item=== descriptor)return false;
                        if( !!descriptor.static != !!item.static)return false;
                        return module.compareDescriptor(item, descriptor);
                    });
                    return !has;
                });
                if(result){
                    return;
                }
            }
            if(stack.isMethodDefinition){
                if(stack.isConstructor || !findInheritMethods(module, stack, stack.value())){
                    getDependencies(stack, dependencies);
                    const result = makeMethod(stack, stack.isConstructor);
                    if(result){
                        bodys.push([result, stack])
                    }
                }

            }else if(stack.isPropertyDefinition){
                getDependencies(stack, dependencies);
                const result = makeProperty(stack);
                if(result){
                    bodys.push([result,stack]);
                }
            }
        });
    });

    dependencies.forEach( dep=>{
        if(dep.isDeclaratorVariable || dep.isDeclaratorTypeAlias){
            globals.add(dep);
        }else if(dep.isModule){
            globals.add(dep);
        }
    });

    contents.push( ...usings );
    contents.push( ...sortMembers(bodys).map(item=>item[0]) )
    contents.push(`\t}`);

    let imports = genImports(stacks.flatMap((stack)=>stack.imports), module, dependencies);
    if(emitFile && module.isClass){
        imports.push(`import ${id} from "${emitFile.replaceAll('\\','/')}";`)
    }

    if(imports.length>0){
        contents.unshift( imports.join('\n\t') )
    }
    
    return makeComments(stacks.flatMap(stack=>stack.comments), contents.join('\n'), '\t');
}

async function emitFileTypes(datamap, buildDir){

    const codeMaps = new Map();
    const globals = new Set();
    const cache = new WeakSet();

    const makeFactory = (module, emitFile)=>{
        if(cache.has(module))return;
        cache.add(module)
        let dataset = codeMaps.get(module.namespace);
        if(!dataset){
            codeMaps.set(module.namespace,dataset=[]);
        }
        let code = makeModule(module, globals, emitFile);
        if(code){
            dataset.push([module.compilation, code]);
        }
    }

    datamap.forEach((emitFile, compilation)=>{
        if(compilation.isGlobalDocument())return;
        if(compilation.isDescriptorDocument())return;
        compilation.modules.forEach((module)=>{
            makeFactory(module,emitFile)
        });
    });

    globals.forEach( stack=>{
        if(stack.compilation && stack.compilation.isGlobalDocument()){
            return;
        }
        if(stack.isModule && stack.isType){
            makeFactory(stack);
        }else{
            const code = makeDeclarator(stack);
            if(code){
                let dataset = codeMaps.get(stack.namespace);
                if(!dataset){
                    codeMaps.set(stack.namespace,dataset=[]);
                }
                dataset.unshift([stack.compilation, makeComments(stack.comments, code, '\t')]);
            }
        }
    });

    const keys = Array.from(codeMaps.keys()).sort((a,b)=>{
        return a.getChain().length - b.getChain().length
    });

    const codes = [];
    keys.forEach(ns=>{
        const code = codeMaps.get(ns).map( item=>item[1] ).join('\n\n');
        codes.push(`package ${ns.fullName}{\n${code}\n}`)
    });
   
    const outfile = path.join(buildDir, 'index.d.es');
    let content = codes.join('\n\n').replace(/\r/g,'');
    fs.writeFileSync(outfile, content, {encoding:"utf-8"});
}


module.exports = {
    emitFileTypes
}