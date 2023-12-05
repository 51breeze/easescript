const Stack = require("../core/Stack");
class JSXNamespacedName extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isJSXNamespacedName= true;
        this.jsxElement = parentStack.jsxElement;
        this.namespace = this.createTokenStack( compilation, node.namespace, scope, node,this );
        this.name = this.createTokenStack( compilation, node.name, scope, node,this );
    }
    freeze(){
        super.freeze();
        this.name && this.name.freeze();
        this.namespace && this.namespace.freeze();
    }
    getXmlNamespace(){
        if( this.parentStack.isJSXOpeningElement || this.parentStack.isJSXAttribute || this.parentStack.isJSXMemberExpression ){
            return this.parentStack.getXmlNamespace( this.namespace.value() );
        }
        return null;
    }

    getAttributeDescription(desc, kind='set'){
        if( desc ){
            return this.compilation.getReference(this.name.value(),desc,false,kind);
        }
        return null;
    }

    definition( context ){
        const stack = context && context.stack;
        if( stack === this.namespace || this.parentStack.isAttributeDirective ){
            const def = this.getXmlNamespace();
            if( def ){
                let ns = def.value.value();
                if( ns.includes('::') ){
                    ns = ns.split('::')[0];
                }
                const expr = this.parentStack.isAttributeDirective ? `${ns}::${this.name.value()}` : def.value.value();
                return {
                    text:`(refs) ${expr}`,
                    location:def.value.getLocation(),
                    file:def.compilation.file,
                    range:this.getLocation()
                };
            }
            return null;
        }
        return this.parentStack.definition( context );
    }
    reference(){
        return null;
    }
    referenceItems(){
        return [];
    }
    description( space , endStack ){
        const name = this.name.value();
        if( this.name.isJSXMemberExpression ){
            return this.name.description(space, endStack);
        }else if( space ){
            if( space.isModule ){
                return space.getMember(name,'set');
            }else if( space.isNamespace ){
                return this.compilation.getModuleById( space.getChain().concat(name).join('.') );
            }
            return null;
        }else {
            return this.compilation.getModuleById( name );
        }
    }
    async descriptionAsync(){
        const name = this.name.value();
        if( this.name.isJSXMemberExpression ){
            return await this.name.description(space, endStack);
        }else if( space ){
            if( space.isModule ){
                return space.getMember(name,'set');
            }else if( space.isNamespace ){
                return await this.loadTypeAsync( space.getChain().concat(name).join('.') );
            }
            return null;
        }else{
            return await this.loadTypeAsync( name );
        }
    }
    type(){
        return this.getGlobalTypeById("void");
    }
    value(){
        return this.name.value();
    }
}

module.exports = JSXNamespacedName;