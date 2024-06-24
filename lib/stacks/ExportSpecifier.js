const JSModule = require("../core/JSModule");
const Namespace = require("../core/Namespace");
const Stack = require("../core/Stack");
class ExportSpecifier extends Stack{
constructor(compilation,node,scope,parentNode,parentStack){
    super(compilation,node,scope,parentNode,parentStack);
        this.isExportSpecifier= true;
        this.local = this.createTokenStack( compilation, node.local, scope, node, this );
        this.exported = this.createTokenStack( compilation, node.exported, scope, node, this );
        let _exports = null;
        if(this.parentStack.parentStack.isModuleDeclaration){
            const _module = this.parentStack.parentStack.module;
            _exports = _module.exports;
        }else if(this.compilation.isDescriptorDocument()){
            _exports =  this.namespace.exports;
        }
        if(_exports){
            let key = this.exported.value();
            if(_exports.has(key)){
                this.exported.error(1195, key, this.namespace.toString())
            }else{
                _exports.set(key, this)
            }
        }
    }

    freeze(){
        super.freeze(this);
        super.freeze(this.exported);
    }

    definition(ctx={}){
        let desc = this.description();
        let location =this.local.getLocation();
        let file = this.file;
        let source = this.parentStack.source && this.parentStack.source.isLiteral;
        const def = {
            text:source ? `import ${this.local.value()}` : `export ${this.exported.value()}`,
            location,
            file,
        };
        if(this.exported === ctx.stack){
            def.text = `export ${this.exported.value()}`;
        }
        if(desc){
            return this.definitionMergeToArray(desc.definition(ctx), def);
        }
        return def;
    }

    reference(){
        const desc = this.description();
        if( desc && !desc.isExportAllDeclaration ){
            return desc.reference();
        }
        return  null;
    }

    referenceItems(){
        const desc = this.description();
        if( desc && !desc.isExportAllDeclaration ){
            return desc.referenceItems();
        }
        return [];
    }

    description(){
        if( this.parentStack.source ){
            const jsModule = this.parentStack.isResolveJsModule ? this.parentStack.getResolveJSModule() : null;
            const local = this.local.value();
            if(jsModule){
                return jsModule.getExport(local);
                // const fetch = (jsModule)=>{
                //     let desc = jsModule.get(local) || jsModule.get('*');
                //     if(!desc)return null;
                //     if(desc.isExportAllDeclaration){
                //         if(desc.source){
                //             const _jsModule = desc.getResolveJSModule();
                //             if(desc.exported){
                //                 if(_jsModule){
                //                     return _jsModule;
                //                 }else{
                //                     return desc.type();
                //                 }
                //             }else{
                //                 if(_jsModule){
                //                     return fetch(_jsModule);
                //                 }else{
                //                     return desc.getAllExportDescriptors().get(local);
                //                 }
                //             }
                //         }else{
                //             return desc.module.get(local)
                //         }
                //     }else if(desc.isExportAssignmentDeclaration){
                //         desc = desc.description();
                //         if(desc){
                //             if(desc.isObjectExpression){
                //                 return desc.attribute(local);
                //             }else if(JSModule.is(desc)){
                //                 return fetch(desc); 
                //             }else if(!desc.expression.isIdentifier){
                //                 desc = desc.type();
                //                 if(desc && desc.isLiteralObjectType){
                //                     return desc.attribute(local);
                //                 }
                //             }
                //         }
                //     }
                //     return null;
                // }
                // return fetch(jsModule);
            }else{
                const compilation = this.parentStack.getResolveCompilation();
                if( compilation && compilation.stack && compilation.stack.exports.length > 0 ){
                    const exports = compilation.stack.exports;
                    for(var i=0; exports.length > i; i++){
                        const item = exports[i];
                        if( item.isExportAllDeclaration ){
                            const descriptors = item.getAllExportDescriptors();
                            const desc = descriptors.get(local);
                            if(desc)return desc;
                        }else if( item.isExportNamedDeclaration ){
                            const desc = item.getDescByName( local );
                            if(desc)return desc;
                        }
                    }
                }
            }
            return null;
        }
        return this.local.description();
    }

    descriptor(){
        const desc = this.description();
        if(this.is(desc))return desc.descriptor();
        return desc;
    }
    
    type(){
        const desc = this.description();
        if( desc )return desc.type();
        return Namespace.globals.get('any');
    }

    parser(){
        if(super.parser()===false)return false;
        if( !this.parentStack.source ){
            this.local.parser();
            this.local.setRefBeUsed();
        }else{
            const desc = this.description();
            if(!desc){
                this.error(1164, this.parentStack.source.value(), this.local.value());
            }else{
                this.local.setRefBeUsed(desc);
            }
        }
    }
}

module.exports = ExportSpecifier;
