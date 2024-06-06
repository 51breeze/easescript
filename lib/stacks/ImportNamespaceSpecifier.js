const Declarator = require("./Declarator");
const Namespace = require("../core/Namespace");
const LiteralObjectType = require("../types/LiteralObjectType");
const Module = require("../core/Module");
class ImportNamespaceSpecifier extends Declarator{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node.local,scope,parentNode,parentStack);
        this.isImportNamespaceSpecifier= true;
        this._kind = 'const';
    }

    freeze(){
        super.freeze(this);
        super.freeze(this.local);
    }

    definition(ctx){
        const desc = this.description();
        let type = 'any';
        if(desc){
            type = desc.type().toString(ctx);
        }
        return {
            comments:this.comments,
            expre:`(import local) ${this.value()}: ${type}`,
            location:this.getLocation(),
            file:this.file,
        };
    }

    toDefinition(ctx){
        const desc = this.description();
        let type = 'any'
        if( desc ){
            if( Module.is(desc) || desc.isDeclaratorFunction || desc.isDeclaratorVariable){
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
            type = desc.type().toString(ctx);
        }
        return {
            expre:`(import refers) ${this.value()}: ${type}`
        };
    }

    description(){
        return this.getAttribute('description', ()=>{
            if( this.parentStack.source.isLiteral ){
                const compilation = this.parentStack.getResolveCompilation();
                if(compilation){
                    const jsModule = this.parentStack.isResolveJsModule ? this.parentStack.getResolveJSModule() : null;
                    if(jsModule){
                        return jsModule.getExportObjectType();
                    }
                }
                if( compilation && compilation.stack && compilation.stack.exports.length > 0 ){
                    const properties = new Map();
                    let exportDefault = null;
                    compilation.stack.exports.forEach( stack=>{
                        if(stack.isExportDefaultDeclaration){
                            exportDefault = stack.description();
                        }else if(stack.isExportNamedDeclaration || stack.isExportAllDeclaration){
                        stack.getAllExportDescriptors().forEach( (value,key)=>{
                                properties.set(key, value)
                        })
                        }
                    });
                    if(exportDefault){
                        properties.set('default', exportDefault)
                    }
                    return properties.size > 0 ? new LiteralObjectType( Namespace.globals.get('object'), null, properties) : Namespace.globals.get('object');
                }else if(!compilation){
                    const source = this.parentStack.source.value();
                    const desc = Namespace.globals.get(source) || Namespace.fetch(source);
                    if(desc ){
                        if(Module.is(desc)){
                            return desc;
                        }else if( desc.isStack && (desc.isDeclaratorFunction || desc.isDeclaratorVariable)){
                            return desc;
                        }else if(Namespace.is(desc)){
                            const properties = new Map();
                            desc.modules.forEach( (value,key)=>{
                                if(Module.is(value)){
                                    properties.set(key, desc);
                                }
                            });
                            desc.descriptors.forEach( (items, key)=>{
                                const desc = items[0]
                                if(desc && (desc.isDeclaratorFunction || desc.isDeclaratorVariable)){
                                    properties.set(key, desc);
                                }
                            });
                            return new LiteralObjectType( Namespace.globals.get('object'), null, properties);
                        }
                    }
                }
            }
            return null;
        })
    }
   
    type(){
        const desc = this.description();
        if(desc){
            if(desc.isNamespace)return desc;
            return desc.type();
        }
        return Namespace.globals.get('any');
    }

    localBinding(){
        if( this.node.type ==="Identifier" ){
            const additional = this.parentStack.additional;
            if( additional ){
                const binding = additional.isDeclaratorVariable   || 
                                additional.isDeclaratorFunction   || 
                                additional.isDeclaratorTypeAlias;
                if(binding){
                    return true;
                }
            }
            const name = this.value();
            if( this.scope.isDefine(name) ){
                const old = this.scope.define(name);
                if( old.compilation === this.compilation && !this.compilation.isDescriptorDocument()){
                    this.error(1025,name);
                }
            }
            this.scope.define(name, this);
        }
    }

    parser(){
        if(super.parser()===false)return false;
        const compilation = this.parentStack.getResolveCompilation();
        if(compilation){
            const jsModule = this.parentStack.isResolveJsModule ? this.parentStack.getResolveJSModule() : null;
            let len = 0;
            if(jsModule){
                len = jsModule.exports.size;
            }else{
                len = compilation ? compilation.stack.exports.length : 0;
            }
            if( !(len>0) ){
                this.parentStack.source.error(1162, this.parentStack.source.value());
            }
        }
    }

}

module.exports = ImportNamespaceSpecifier;
