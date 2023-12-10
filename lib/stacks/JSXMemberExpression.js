const Stack = require("../core/Stack");
const Utils = require("../core/Utils");
class JSXMemberExpression extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isJSXMemberExpression= true;
        this.jsxElement = parentStack.jsxElement;
        this.object = this.createTokenStack( compilation, node.object, scope, node, this );
        this.property = this.createTokenStack( compilation, node.property, scope, node,this );
        this.hasNamespaced = !!this.object.isJSXNamespacedName;
    }
    reference(called){
        return null;
    }
    referenceItems(called){
        return [];
    }
    definition( context ){
        return this.parentStack.definition( context );
    }
    getFirstMemberStack(){
        if( this.object.isJSXMemberExpression ){
            return this.object.getFirstMemberStack();
        }else{
            return this.object;
        }
    }
    getXmlNamespace(ns){
        if( this.parentStack.isJSXOpeningElement ){
            return this.parentStack.getXmlNamespace(ns);
        }
        return null;
    }
    description(space, endStack ){
        const property = this.property.value();
        let desc = null;
        if( this.object.isJSXMemberExpression ){
            desc = this.object.description( space, endStack );
        }else if(space){
            if( space.isModule ){
                return space.getDescriptor(property, (desc)=>{
                    if( desc.isPropertyDefinition && Utils.isModifierPublic(desc) && !desc.isReadonly){
                        return true;
                    }else if(desc.isMethodSetterDefinition && Utils.isModifierPublic(desc)){
                        return true;
                    }else{
                        return false;
                    }
                })
            }else if( space.isNamespace ){
                return this.getModuleById(space.fullName+'.'+property, Namespace.dataset);
            }
        }

        if( endStack && endStack !== this.property ){
            return desc;
        }

        if( desc ){
            desc = desc.isModule ? desc : Utils.getOriginType( desc.type() );
            return desc.getDescriptor(property, (desc)=>{
                if( desc.isPropertyDefinition && Utils.isModifierPublic(desc) && !desc.isReadonly){
                    return true;
                }else if(desc.isMethodSetterDefinition && Utils.isModifierPublic(desc)){
                    return true;
                }else{
                    return false;
                }
            })
        }
        return null;
    }
    type(){
        return this.getGlobalTypeById("void");
    }
    parser(){
        if(super.parser()===false)return false;
        this.object.parser();
        this.property.parser();
    }
    raw(){
        return `${this.object.raw()}.${this.property.raw()}`;
    }
    value(){
        return `${this.object.value()}.${this.property.value()}`;
    }
}
module.exports = JSXMemberExpression;