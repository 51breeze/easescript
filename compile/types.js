const Utils = require('../lib/core/Utils');
const Namespace = require('../lib/core/Namespace');
const Context = require('../lib/core/Context');
const fs = require('fs');
const path = require('path');

function makeRawType(type, defaultType='any', inferFlag = false){
    if(!type)return ': '+defaultType;
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
    Context.setDefaultInferType(Namespace.globals.get('any'))
    const str =  ': '+ type.type().toString({}, {
        complete:true,
        onlyTypeName,
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

function makeGenericity(genericity){
    if(!genericity || !genericity.elements.length)return '';
    const genericElements = genericity.elements.map( item=>{
        if( item.isGenericTypeAssignmentDeclaration ){
            return `${item.left.value()} = ${item.right.value()}`;
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

function makeFunction(stack, typeWhenExists=false){
    const genericity = makeGenericity(stack.genericity);
    let returnType = '';
    if(typeWhenExists){
        if(stack._returnType){
            returnType = makeRawType(stack._returnType, 'any');
        }
    }else{
        returnType = makeRawType(stack._returnType || stack.getReturnedType(), 'void', true);
    }
    return `${genericity}(${makeFunctionParams(stack.params)})${returnType}`.replace(/(\t+)/g,(a,b)=>{
        return b+'\t\t';
    }).replace(/[\r\n]}/,'\n\t\t}')
}

function makeComments(comments, descriptor, indent='\t\t'){
    if(!comments || !comments.length)return descriptor;
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

function makeMethod(stack, isConstructor){
    if(!stack.isMethodDefinition)return null;
    const modifier = Utils.getModifierValue(stack)
    if(modifier==='private')return null;
    let method = ['\t\t'];
    let key = stack.key.value();
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
    return makeComments(stack.comments, method.join(''));
}

function makeProperty(stack){
    if(!stack.isPropertyDefinition)return null;
    const modifier = Utils.getModifierValue(stack)
    if(modifier==='private')return null;
    let property = ['\t\t'];
    let key = stack.value();
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
    return makeComments(stack.comments, property.join(''));
}

function makeImport(stack, module, dependencies){
    if(stack.source.isLiteral)return null;
    const desc = stack.description();
    if(!desc)return null;
    if(desc.namespace === module.namespace)return null;
    if(!module.dependencies.has(desc)){
        return null;
    }
    if(!dependencies.has(desc))return null;
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

function genImports(stack, module, dependencies){
    return stack.imports.map( imp=>makeImport(imp, module, dependencies) ).filter(item=>!!item);
}

function getDependencyType(type,dataset){
    if(!type||!type.isType)return;
    if(type.isModule){
        dataset.add(type);
    }else if(type.isClassGenericType || type.isTupleType || type.isUnionType){
        type.elements.forEach(item=>{
            getDependencyType(item.type(), dataset);
        });
    }else if(type.isAliasType && (type=type.inherit)){
        getDependencyType(type.type(), dataset);
    }else if(type.isIntersectionType){
        getDependencyType(type.left.type(), dataset);
        getDependencyType(type.right.type(), dataset);
    }else if(type.isKeyofType && (type=type.referenceType)){
        getDependencyType(type.type(), dataset);
    }else if(type.isFunctionType){
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

function getDependencies(stack, dataset){
    if(!stack || !dataset)return;
    if(stack.isEnumDeclaration || stack.isClassDeclaration || stack.isDeclaratorDeclaration || stack.isInterfaceDeclaration){
        //isStructTableDeclaration
    }else if(stack.isMethodDefinition){
        stack = stack.expression;
        stack.params.forEach(item=>{
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

async function emitFileTypes(datamap, buildDir){

    const codeMaps = new Map();

    datamap.forEach((emitFile, compilation)=>{
        if(compilation.isGlobalDocument())return;
        compilation.modules.forEach(module=>{
            if(!module.used)return;
            const id = module.id
            const kind = module.isClass ? 'class' : 'interface';
            const moduleContents = [];
            

            module.getStacks().forEach( stack=>{
                
                if(stack.isEnumDeclaration){
                    return;
                }
                
                let inherit = '';
                let implements = '';
                let genericity = makeGenericity(stack.genericity);
                const dependencies = new Set();
                if(stack.inherit){
                    dependencies.add(module.inherit.type())
                    inherit = `extends ${stack.inherit.value()}${makeAssignGenerics(stack.inherit.assignGenerics)}`
                }
                if(stack.implements && stack.implements.length>0){
                    module.implements.forEach( dep=>{
                        dependencies.add(dep)
                    });
                    const imps = stack.implements.map( imp=>{
                        return `${imp.value()}${makeAssignGenerics(imp.assignGenerics)}`
                    });
                    implements = ` implements ${imps.join(', ')}`;
                }

                const contents = [];
                contents.push(`\tdeclare ${kind} ${id}${genericity} ${inherit}${implements}{`);

                const bodys = [];
                stack.body.forEach( stack=>{
                    if(stack.isMethodDefinition){
                        if(stack.isConstructor || !findInheritMethods(module, stack, stack.value()) ){
                            getDependencies(stack, dependencies);
                            const result = makeMethod(stack, stack.isConstructor);
                            if(result){
                                bodys.push(result)
                            }
                        }
                    }else if( stack.isPropertyDefinition ){
                        getDependencies(stack, dependencies);
                        const result = makeProperty(stack);
                        if(result){
                            bodys.push(result);
                        }
                    }
                });

                contents.push(bodys.join('\n'))
                contents.push(`\t}`);

                let imports = genImports(stack, module, dependencies);
                if(module.isClass){
                    imports.push(`import ${id} from "./${emitFile.replaceAll('\\','/')}";`)
                }

                if(imports.length>0){
                    contents.unshift('\t'+imports.join('\n\t'))
                }

                moduleContents.push(makeComments(stack.comments, contents.join('\n'), '\t', '\t'))

            });

            if( moduleContents.length ){
                let dataset = codeMaps.get(module.namespace);
                if(!dataset){
                    codeMaps.set(module.namespace,dataset=[]);
                }
                dataset.push([compilation, moduleContents]);
            }
        })
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
    fs.writeFileSync(outfile, codes.join('\n\n'))
}


module.exports = {
    emitFileTypes
}