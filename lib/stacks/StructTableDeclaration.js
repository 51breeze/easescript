const Stack = require("../core/Stack");
const Utils = require("../core/Utils");
const ClassScope = require("../scope/ClassScope");
class StructTableDeclaration extends Stack{
    constructor(compilation,node,scope,parentNode,parentStack){
        scope = new ClassScope(scope);
        super(compilation,node,scope,parentNode,parentStack);
        this.isStructTableDeclaration= true;
        this._metatypes = [];
        this._annotations = [];
        this.body =[];
        this.imports =[];
        this.id = this.createTokenStack(compilation,node.id,scope,node,this);
        const module =this.module=compilation.createModule(this.namespace, this.id.value(), false);
        this.id.module = module;
        this.extends = (node.extends||[]).map( item=>this.createTokenStack(compilation,item,scope,node,this) );
        module.isInterface = true;
        module.isStructTable = true;
        compilation.addModuleStack(module,this);
    }

    set metatypes(value){
        value.forEach( item=>{
            item.additional = this;
        });
        if( value.length > 0 ){
            this._metatypes = value;
        }
    }

    get metatypes(){
       return this._metatypes;
    }

    set annotations(value){
        value.forEach( annotation=>{
            annotation.additional = this;
        });
        if( value.length > 0 ){
            this._annotations = value;
        }
    }

    get annotations(){
        return this._annotations;
    }

    definition( ctx ){
        const any = this.getGlobalTypeById('any').toString();
        const columns = this.body.filter( item=>item.isStructTableColumnDefinition ).map( item=>{
            const name = item.key.value();
            const desc = item.description();
            let type = any
            if( desc )type = desc.type().toString();
            if( item.question ){
                return `${name}?:${type}`;
            }
            return `${name}:${type}`;
        })
        return {
            comments:this.comments,
            kind:'struct',
            expre:`struct ${this.module.getName()}:{\r\n\t${columns.join('\r\n\t')}\r\n}`,
            location:this.id.getLocation(),
            file:this.compilation.file,
        };
    }
    async createCompleted(){
        const compilation = this.compilation;
        this.imports.forEach( stack=>{
            stack.parser();
            stack.addImport(this.module, this.parentStack.scope);
        });

        this.module.extends = this.extends.map( inherit =>{
            const module = this.getModuleById( inherit.value() );
            if( module ){
                if( Utils.checkDepend(this.module,module) ){
                    inherit.error(1024,inherit.value(), this.module.getName(), module.getName());
                }else{
                    module.used = true;
                    module.children.push(this.module);
                    this.compilation.addDependency(module,this.module );
                    return module;
                }
            }else{
                inherit.error(1027,inherit.value());
            }
        }).filter( item=>!!item );

        this.node.body.map( item=>{
            const stack = this.createTokenStack( compilation, item, this.scope, this.node, this);
            if( stack ){
                this.body.push(stack);
            }
        });
    }
    
    type(){
        return this.module;
    }

    description(){
        return this;
    }

    parser(){
        if(super.parser()===false)return false;
        const cache = {};
        this.extends.forEach(item=>{
            item.parser();
            item.setRefBeUsed();
        })
        this.body.forEach(item=>{
            item.parser();
            if( !(item.isIdentifier || item.isMemberExpression) ){
                if( item.isStructTableKeyDefinition && item.local.isStructTableMethodDefinition ){
                    const key = item.local.key.value();
                    if( cache[key] ){
                        cache[key].error(1168);
                        item.local.key.error(1168);
                    }
                    cache[key] = item.local.key;
                }
            }
        });
    }

    value(){
        return this.id.value();
    }
}

module.exports = StructTableDeclaration;