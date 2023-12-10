const Stack = require("../core/Stack");
const Utils = require("../core/Utils");
class PropertyDefinition extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isPropertyDefinition= true;
        this._metatypes = [];
        this._annotations = [];
        this.kind = node.kind;
        this.isReadonly = this.kind === 'const';
        this.modifier = this.createTokenStack( compilation, node.modifier, scope, node,this );
        this.static  = this.createTokenStack(compilation,node.static,scope,node,this);
        this.declarations = node.declarations.map( item=>{
            return this.createTokenStack( compilation, item, scope, node,this );
        });
        this.isFinal = false;
        if( this.declarations[0].dynamic ){
            this.module.dynamic = true;
        }else{
            if( !this.parentStack.isUseStatement ){
                this.module.addMember(this.declarations[0].id.value(), this);
            }
        }
    }
    freeze(){
        super.freeze();
        super.freeze( this.declarations );
        this.modifier && this.modifier.freeze();
        this.static && this.static.freeze();
        this.declarations.forEach( stack=>stack.freeze() );
    }
    definition(ctx){
        const identifier = this.value();
        const context    = this;
        const modifier = this.modifier ? this.modifier.value() : "public";
        const _static = this.static ? 'static ' : '';
        const def = this.declarations[0].definition( ctx );
        return {
            kind:"property",
            comments:context.comments,
            identifier:identifier,
            expre:`(property) ${_static}${modifier} ${def.expre}`,
            location:this.declarations[0].getLocation(),
            file:this.compilation.file,
        };
    }
    set metatypes(value){
        value.forEach( metatype=>{
            metatype.additional = this;
        });
        this._metatypes = value;
    }
    get metatypes(){
       return this._metatypes;
    }
    set annotations(value){
        value.forEach( annotation=>{
            annotation.additional = this;
        });
        this.isFinal = value.some( (annotation)=>{
            return annotation.name.toLowerCase() ==="final";
        });
        this._annotations = value;
    }
    get annotations(){
        return this._annotations;
    }
    get init(){
        return this.declarations[0].init;
    }
    get dynamic(){
        return !!this.declarations[0].dynamic;
    }
    get question(){
        return !!this.declarations[0].id.node.question;
    }
    get id(){
        return this.declarations[0].id;
    }
    get key(){
        return this.declarations[0].id;
    }
    get acceptType(){
        return this.declarations[0].acceptType;
    }
    get dynamicKeyType(){
        return this.declarations[0].dynamicKeyType;
    }
    get assignItems(){
        return this.declarations[0].assignItems;
    }
    get useRefItems(){
        return this.declarations[0].useRefItems;
    }
    addUseRef( stack ){
        this.declarations[0].addUseRef(stack);
    }
    assignment(value, stack=null){
        this.declarations[0].assignment(value, stack);
    }
    reference(){
        return this.declarations[0].reference();
    }
    referenceItems(){
        return this.declarations[0].referenceItems();
    }
    description(){
        return this.declarations[0].description();
    }
    type(){
        return this.declarations[0].type();
    }
    parser(){
        if(super.parser()===false)return false;

        this._annotations.forEach( item=> item.parser() )
        this._metatypes.forEach( item=> item.parser() )

        this.declarations[0].parser();
        if( this.parentStack.isUseStatement ){
            return true;
        }

        if( this.dynamic ){
            const acceptType = this.dynamicKeyType ? this.dynamicKeyType.type() : this.getGlobalTypeById('string');
            const result = acceptType && ['string','number'].some( type=>acceptType.check( this.getGlobalTypeById(type) ) )
            if( !result ){
                this.acceptType.error(1139,this.id.value());
            }else{
                this.module.dynamicProperties.set( Utils.getOriginType( acceptType ) , this );
            }
        }else if(this.module && !this.module.isDeclaratorModule ){
            const parent = this.module && this.module.extends[0];
            if( parent ){
                const modifier = this.modifier ? this.modifier.value() : "public";
                if(modifier!=="private"){
                    const parentProperty = parent.getMember( this.id.value() );
                    if( parentProperty && parentProperty.modifier && parentProperty.modifier.value() !=="private" ){
                        if( !parentProperty.isPropertyDefinition ){
                            this.id.error(1082,this.value())
                        }
                    }
                    if( parentProperty && parentProperty.isFinal ){
                        this.id.error(1149, this.id.value() )
                    }
                }
            }
        }
        
    }
    error(code,...args){
        this.declarations[0].error(code,...args)
    }
    warn(code,...args){
        this.declarations[0].warn(code,...args)
    }
    value(){
        return this.declarations[0].value();
    }
    raw(){
        return this.declarations[0].raw();
    }
}

module.exports = PropertyDefinition;