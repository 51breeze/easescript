const Stack = require("../core/Stack");
const path = require("path");
class JSXStyle extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isJSXStyle= true;
        this.jsxElement = this;
        this.openingElement = this.createTokenStack( compilation, node.openingElement, scope, node, this );
        this.closingElement = this.createTokenStack( compilation, node.closingElement, scope, node, this );
        this.absoluteFile = null;
        this.attributeFile = this.openingElement.attributes.find(item=>item.name.value().toLowerCase() ==="file");
        this.styleContent = node.children.map( item=>item.raw ).join('');
        this.styleKey = compilation.jsxStyles.length+1;
        compilation.jsxStyles.push( this );
        const file = this.attributeFile;
        const target = this.module || this.compilation;
        if( file ){
            const url = file.value.value();
            const resolve = this.compiler.resolveManager.resovleAssets(url, this.file);
            if( !resolve ){
                this.error(1118, url );
            }else{
                this.absoluteFile = resolve;
                if(!target.addAsset( resolve, url, null, path.extname(url), null, null, this)){
                    this.error(1107, url );
                }
            }
        }else{
            const content = this.styleContent.trim();
            if(content){
                const key = this.styleKey;
                const attributes = {};
                this.openingElement.attributes.forEach( attr=>{
                    const key = attr.name.value().toLowerCase();
                    let value = attr.value ? attr.value.value() : true;
                    if(value==='false' || value==='true'){
                        value = Boolean(value);
                    }
                    attributes[key] = value;
                });
                let format = 'css';
                let lang = attributes.lang || attributes.type;
                if( lang ){
                    format = String(lang).trim();
                    if( format.includes('.') ){
                        format = format.replace(/^\./,'');
                    }
                }
                if( !target.addAsset(key+'.'+format, null, content, 'style', null, attributes, this) ){
                    this.error(1107, key);
                }
            }
        }
    }

    get attributes(){
        if( this.isAttrClone ){
            return this._attributes;
        }
        return this.openingElement.attributes.slice(0);
    }

    description(){
        return null;
    }

    value(){
        return this.styleContent;
    }
}

module.exports = JSXStyle;