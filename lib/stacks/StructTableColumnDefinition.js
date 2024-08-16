const Stack = require("../core/Stack");
class StructTableColumnDefinition extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isStructTableColumnDefinition = true;
        this.isPropertyDefinition = true;
        this.isProperty=true;
        this.question = !!node.question;
        this.key = this.createTokenStack(compilation,node.key,scope,node,this);
        this.typename = this.createTokenStack(compilation,node.typename,scope,node,this);
        this.unsigned = node.typename ? !!node.typename.unsigned : false;
        this.properties = node.properties.map( item=>this.createTokenStack(compilation,item,scope,node,this) );
        this.module.addMember(this.key.value(), this);
        this.assignItems = new Set();
        this.assignValue=null;
    }

    definition( ctx ){
        const location = this.key.getLocation()
        const question = this.question ? '?' : '';
        return {
            comments:this.comments,
            expre:`(struct) column ${this.key.value()}${question}: ${this.type().toString(ctx)}`,
            location:location,
            file:this.compilation.file,
        };
    }

    get kind(){
        return 'init' 
    }

    assignment(value, stack=null){
        if( this.assignValue !== value  ){
            let assignDesc = null;
            if( value && value.isStack ){
                assignDesc = value.description();
            }
            if( assignDesc ){
                if( assignDesc === this || (assignDesc.isStack && assignDesc.description() === this) ){
                    this.setRefBeUsed( assignDesc );
                    return;
                }
            }
            this.checkExpressionType(this.type(), value, stack)
            this.assignItems.add( value );
            if(!this.assignValue){
                this.assignValue = value;
            }
            if( assignDesc ){
                this.setRefBeUsed( assignDesc );
            }
        }
    }

    reference(){
        return this.assignValue ? this.assignValue.reference() : null;
    }

    referenceItems(){
        let items = [];
        this.assignItems.forEach( item=>{
            items=items.concat( item.referenceItems() );
        });
        return items;
    }

    get acceptType(){
        return null;
    }

    get id(){
        return this.key;
    }

    get dynamic(){
        return false;
    }

    description(){
        return this;
    }

    type(){
        const desc = this.typename && this.typename.description();
        if( !desc )return this.getGlobalTypeById('string');
        return desc.type();
    }

    getAnnotationAlias(flag=true){
        const result = this.getAttribute('getAnnotationAlias',()=>{
            return this.findAnnotation(annot=>annot.getLowerCaseName() === 'alias' ? annot : false)
        })
        if(flag){
            if(result){
                const [annot] = result;
                if(annot && annot.isAnnotationDeclaration){
                    const args = annot.getArguments();
                    if(args[0]){
                        return args[0].value;
                    }
                }
            }
            return null;
        }
        return result
    }

    parser(){
        if(super.parser()===false)return false;
        
        if(this.typename){
            this.typename.parser();
        }
        this.properties.forEach(item=>{
            if( !(item.isIdentifier || item.isMemberExpression) ){
                if(item.isStructTablePropertyDefinition && item.key.value().toLowerCase()==='default'){
                    if( this.typename ){
                        const desc = this.typename.description();
                        if( desc ){
                            this.checkExpressionType(desc, item.init);
                        }
                    }
                }
                item.parser();
            }
        });
        
    }
    
    value(){
        return this.key.value();
    }
}

module.exports = StructTableColumnDefinition;