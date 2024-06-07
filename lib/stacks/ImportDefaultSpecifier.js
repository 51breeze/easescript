const Declarator = require("./Declarator");
const Namespace = require("../core/Namespace");
const Module = require("../core/Module");
class ImportDefaultSpecifier extends Declarator{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node.local,scope,parentNode,parentStack);
        this.isImportDefaultSpecifier= true;
        this._kind = 'const';
    }

    freeze(){
        super.freeze(this);
    }

    definition(ctx){
        const desc = this.description();
        if( desc ){
            return {
                comments:desc.comments,
                expre:`(import local) ${this.value()}:${desc.type().toString(ctx)}`,
                location:this.getLocation(),
                file:this.file
            };
        }
        return {
            expre:`(import local) ${this.value()}: any`,
            location:this.getLocation(),
            file:this.file
        };
    }

    toDefinition(ctx){
        const desc = this.description();
        if(desc){
            const def = desc.definition(ctx) || {};
            const comments = def.comments || desc.comments;
            const location = def.location || desc.isStack && desc.getLocation();
            const file = def.file || desc.file;
            let type = desc.type().toString(ctx)
            let expre = `(import refers) ${this.value()}: ${type}`;
            if(Module.is(desc)){
               const kind = desc.getModuleKind();
               expre = `(import refers) ${kind} ${type}`;
            }
            return {
                comments:comments,
                expre,
                location,
                file
            };
        }
        return {
            expre:`(import refers) ${this.value()}: any`,
        };
    }

    description(){
        if( this.parentStack.source.isLiteral ){
            const compilation = this.parentStack.getResolveCompilation();
            if(compilation){
                const jsModule = this.parentStack.isResolveJsModule ? this.parentStack.getResolveJSModule() : null;
                if(jsModule){
                    return jsModule.get('default');
                }
            }

            if( compilation && compilation.stack && compilation.stack.exports.length > 0 ){
                const result = compilation.stack.exports.find( item=>item.isExportDefaultDeclaration );
                if( result ){
                    return result.description();
                }
            }else if(!compilation){
                const source = this.parentStack.source.value();
                const desc = Namespace.globals.get(source);
                if(desc ){
                    if(Module.is(desc)){
                        return desc;
                    }else if(desc.isDeclaratorFunction || desc.isDeclaratorVariable){
                        return desc;
                    }
                }
            }
        }
        return null;
    }
   
    type(){
        const desc = this.description();
        if(desc)return desc.type();
        return Namespace.globals.get('any');
    }

    localBinding(){
        const name = this.value();
        const additional = this.parentStack.additional;
        if( additional ){
            const binding = additional.isDeclaratorVariable   || 
                            additional.isDeclaratorFunction   || 
                            additional.isDeclaratorTypeAlias;
            if(binding){
                return true;
            }
        }
        if( this.scope.isDefine(name) ){
            const old = this.scope.define(name);
            if( old.compilation === this.compilation && !this.compilation.isDescriptorDocument()){
                this.error(1025,name);
            }
        }
        this.scope.define(name, this);
    }
    parser(){
        if(super.parser()===false)return false;
        const compilation = this.parentStack.getResolveCompilation();
        if(compilation){
            const jsModule = this.parentStack.isResolveJsModule ? this.parentStack.getResolveJSModule() : null;
            let len = 0;
            if(jsModule){
                len = jsModule.getExportCount();
            }else{
                const compilation = this.parentStack.getResolveCompilation();
                len = compilation ? compilation.stack.exports.length : 0;
            }
            if( !(len>0) ){
                this.error(1162, this.parentStack.source.value());
            }
        }
        const desc = this.description();
        if(!desc){
            if(compilation){
                this.error(1164, this.parentStack.source.value(), 'default');
            }
        }else{
            this.setRefBeUsed(desc);
        }
    }
}

module.exports = ImportDefaultSpecifier;