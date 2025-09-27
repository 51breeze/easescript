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
        this.isRemoved = false;
        this.isDeprecated = false;
        this.isNoop = false;
        if( this.declarations[0].dynamic ){
            this.module.dynamic = true;
        }else{
            if( !this.parentStack.isUseStatement ){
                this.module.addMember(this.declarations[0].id.value(), this);
            }
        }
        if(!this.compilation.isDescriptorDocument() && !Utils.isModifierPublic(this)){
            this.compilation.hookAsync('compilation.parser.after',async ()=>{
                if(!this.useRefItems.size){
                    this.unnecessary(1183, this.value());
                }
            });
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
        const context    = this;
        const modifier = this.modifier ? this.modifier.value() : "public";
        const _static = this.static ? 'static ' : '';
        const def = this.declarations[0].definition( ctx );
        return {
            kind:"property",
            comments:context.comments,
            expre:`(property) ${_static}${modifier} ${def.expre}`,
            location:this.declarations[0].id.getLocation(),
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
            switch( annotation.name.toLowerCase() ){
                case 'override' :
                    this.override = true;
                break;
                case 'final' :
                    this.isFinal = true;
                break;
                case 'deprecated' :
                    this.isDeprecated = true;
                break;
                case 'removed' :
                    this.isRemoved = true;
                case 'noop' :
                    this.isNoop = true;
                break;
            }
        });
        this._annotations = value;
    }
    getContext(){
        return this.declarations[0].getContext();
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
    get computed(){
        return !!this.declarations[0].computed;
    }
    get question(){
        return !!this.declarations[0].question;
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
    assignment(value, stack=null, ctx=null){
        this.declarations[0].assignment(value, stack, ctx);
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

        this._annotations.forEach( item=> item.parser() )
        this._metatypes.forEach( item=> item.parser() )

        this.declarations[0].parser();
        if( this.parentStack.isUseStatement ){
            return true;
        }

        if(this.dynamic){
            let acceptType = null;
            if(this.dynamicKeyType){
                this.dynamicKeyType.parser();
                acceptType = this.dynamicKeyType.type();
            }else{
                this.id.parser();
                acceptType = this.id.type();
            }
            if(acceptType){
                this.module.dynamicProperties.set(acceptType, this);
            }
        }else if(this.module && !this.module.isDeclaratorModule ){
            const parent = this.module && this.module.getInheritModule();
            if( parent ){
                const modifier = Utils.getModifierValue(this);
                if(modifier!=="private"){
                    const parentProperty = parent.getMember( this.id.value() );
                    if( parentProperty && Utils.getModifierValue(parentProperty) !=="private" ){
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