const Declarator = require("./Declarator");
const Namespace = require("../core/Namespace");
const LiteralObjectType = require("../types/LiteralObjectType");
const Module = require("../core/Module");
const JSModule = require("../core/JSModule");
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
        let alias = '';
        let comments = this.comments.slice(0);
        if(desc){
            if(desc.isExportAssignmentDeclaration){
                let def = desc.definition(ctx)
                if(def){
                    if(!Array.isArray(def)){
                        def = [def];
                    }
                    alias = def.map( def=>{
                        if(def.comments){
                            comments.push( ...def.comments );
                        }
                        return '(alias) '+def.expre;
                    }).join('\n') + '\n';
                }
            }
        }
        return {
            comments,
            expre:`${alias}import ${this.value()}`,
            location:this.getLocation(),
            file:this.file,
        }
    }

    toDefinition(ctx){
        const desc = this.description();
        const comments = this.comments.slice(0);
        const def = {
            comments,
            expre:`import ${this.value()}`,
            location:this.getLocation(),
            file:this.file,
        };
        
        if( desc ){
            if(desc.isExportAssignmentDeclaration){
                let res = desc.definition(ctx)
                if(res){
                    if(!Array.isArray(res)){
                        res = [res];
                    }
                    let alias = res.map( def=>{
                        if(def.comments)comments.push(...def.comments);
                        return '(alias) '+def.expre;
                    }).concat(def.expre).join('\n') + '\n';
                    return res.map( def=>{
                        return {
                            expre:alias,
                            location:def.location,
                            file:def.file,
                            comments,
                        }
                    }).concat(def);
                }
            }
        }
        return def;
    }

    description(){
        return this.getAttribute('description', ()=>{
            if( this.parentStack.source.isLiteral ){
                const compilation = this.parentStack.getResolveCompilation();
                if(compilation){
                    const jsModule = this.parentStack.isResolveJsModule ? this.parentStack.getResolveJSModule() : null;
                    if(jsModule){
                        if(jsModule.exports.has('*')){
                            return jsModule.exports.get('*');
                        }else{
                            return jsModule.getExportObjectType();
                        }
                    }
                }
                if( compilation && compilation.stack && compilation.stack.exports.length > 0 ){
                    const properties = new Map();
                    let exportDefault = null;
                    compilation.stack.exports.forEach( stack=>{
                        if(stack.isExportDefaultDeclaration){
                            exportDefault = stack.description();
                        }else if(stack.isExportNamedDeclaration || stack.isExportAllDeclaration){
                            stack.getAllExportDescriptors(stack).forEach( (value,key)=>{
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
                        if( desc.isStack && (desc.isDeclaratorFunction || desc.isDeclaratorVariable)){
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
    }

}

module.exports = ImportNamespaceSpecifier;
