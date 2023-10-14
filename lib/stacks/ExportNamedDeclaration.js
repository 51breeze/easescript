const Stack = require("../core/Stack");
class ExportNamedDeclaration extends Stack {
    constructor(compilation,node,scope,parentNode,parentStack){ 
        super(compilation,node,scope,parentNode,parentStack);
        this.isExportNamedDeclaration = true;
        this.declaration = this.createTokenStack(compilation, node.declaration, scope, node, this);
        this.source = this.createTokenStack(compilation, node.source, scope, node, this);
        this.specifiers = node.specifiers && node.specifiers.map( item=>this.createTokenStack(compilation, item, scope, node, this) );
        if( parentStack && !(parentStack.isProgram || parentStack.isPackageDeclaration) ){
            this.error(1159);
        }
    }

    definition( ctx ){
        if( this.source && this.source.isLiteral ){
            const resolveCompilation = this.getResolveCompilation();
            if( resolveCompilation ){
                if ( !ctx || ctx.stack === this.source ){
                    return {
                        expre:`module "${resolveCompilation.file}"`,
                        location:resolveCompilation.stack.getLocation(),
                        file:resolveCompilation.file,
                        range:this.source.getLocation()
                    };
                }
            }
        }else if( this.declaration ){
            return this.declaration.definition( ctx );
        }
        return null;
    }

    freeze(){
        super.freeze();
        this.declaration && this.declaration.freeze();
        this.source && this.source.freeze();
        this.specifiers.forEach( item=>item.freeze() );
    }

    getKeyName(){
        if( this.declaration ){
            if( this.declaration.isClassDeclaration ){
               return this.declaration.module.id;
            }else if( this.declaration.isFunctionDeclaration ){
               return local === item.declaration.key.value() ? item.declaration : null;
            }else if( this.declaration.isAssignmentExpression ){
               return local === item.declaration.left.value() ? item.declaration : null;
            }else if( this.declaration.isIdentifier ){
               return local === item.declaration.value() ? item.declaration : null;
            }else if( this.declaration.isVariableDeclaration ){
               const result = item.declaration.declarations.find( decl=>decl.id.value() === local );
               return result ? result : null;
            }
        }
    }

    getDescByName( name ){
        if( this.declaration ){
            const decl = this.declaration;
            if( decl.isClassDeclaration ){
               return decl.module.id === name ? decl.module : null;
            }else if( decl.isFunctionDeclaration ){
               return name === decl.key.value() ? decl : null;
            }else if( decl.isAssignmentExpression ){
               return name === decl.left.value() ? decl : null;
            }else if( decl.isIdentifier ){
               return name === decl.value() ? decl : null;
            }else if( decl.isVariableDeclaration ){
               const result = decl.declarations.find( de=>de.id.value() === name );
               return result ? result : null;
            }
        }else if( this.specifiers && this.specifiers.length > 0 ){
            const result = this.specifiers.find( specifier=>{
                return specifier.exported.value() === name 
            });
            if( result ){
               return result.description();
            }
        }
    }

    getResolveFile(){
        if( this.source && this.source.isLiteral ){
            if(this.resolve !== void 0)return this.resolve;
            const resolve = this.resolve = this.compiler.resolve(this.source.value(), this.compilation.file);
            if( !resolve ){
                this.source.error(1122, this.source.value());
            }
            return resolve;
        }
    }

    getResolveCompilation(){
        if(this.resolveCompilation !== void 0)return this.resolveCompilation;
        this.resolveCompilation = null;
        if( this.compiler.options.suffix === this.getFileExt() ){
            const compilation = this.resolveCompilation = this.compilation.createChildCompilation(this.getResolveFile(), this.compilation.file, null);
            if( !compilation ){
                this.source.error(1132, this.source.value() );
            }else{
                compilation.import = 'importSpecifier';
            }
            return compilation;
        }
        return null;
    }

    getFileExt(){
        const resolve = this.getResolveFile();
        if( resolve ){
            const pos = resolve.lastIndexOf('.');
            if(pos>0){
                return resolve.substring(pos);
            }
        }
        return null;
    }

    type(){
        return this.getGlobalTypeById('any');
    }

    parser(){ 
        this.declaration && this.declaration.parser();
        this.specifiers.forEach( item=>item.parser() );
        const resolve = this.getResolveFile();
        if(resolve){
            const compilation = this.getResolveCompilation();
            if(compilation){
                compilation.parser();
                if( !(compilation.stack.exports.length>0) ){
                    this.source.error(1162, this.source.value());
                }
            }
        }
    }
}

module.exports = ExportNamedDeclaration;