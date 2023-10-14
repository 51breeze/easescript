const Stack = require("../core/Stack");
const path = require("path");
const uniqueId = require("lodash/uniqueId");
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
        compilation.jsxStyles.push( this );
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

    parser(){
        if( !super.parser() )return false;
        const file = this.attributeFile;
        const target = this.module || this.compilation;
        if( file ){
            const url = file.value.value();
            const resolve = this.compiler.resolve(url, this.file);
            if( !resolve ){
                this.error(1118, url );
            }else{
                this.absoluteFile = resolve;
                if(!target.addAsset( resolve, url, null, path.extname(url), null) ){
                    this.error(1107, url );
                }
            }
        }else{
            const content = this.styleContent.trim();
            if(content){
                const key = uniqueId( content.length );
                const typeAttr = this.openingElement.attributes.find(item=>item.name.value().toLowerCase() ==="type")
                var format = '.css';
                if( typeAttr ){
                    format = '.'+typeAttr.value.value().replace(/^\./,'');
                }
                if( !target.addAsset(key+format, null, content, 'style', null) ){
                    this.error(1107, key);
                }
            }
        }
        return true;
    }
    value(){
        return this.styleContent;
    }
}

module.exports = JSXStyle;