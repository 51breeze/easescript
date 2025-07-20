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
        try{
            const compilation = this.compilation;
            const metatypes = [];
            const annotations = [];
            const self = this.module;
            await this.allSettled(this.imports,async(stack)=>await stack.addImport(self, this.parentStack.scope));

            if( this.extends.length>0 ){
                await this.allSettled(this.extends.map( async (stack)=>{
                    let id = stack.value();
                    let module = stack.getReferenceModuleType();
                    let load = false;
                    let local = stack.isMemberExpression ? stack.getFirstMemberStack().value() : id;
                    if(!this.scope.isDefine(local)){
                        module = await this.loadTypeAsync(id);
                        load = true;
                    }
                    let push = (module, stack)=>{
                        if( !module ){
                            stack.error(1027, id);
                        }else{
                            if( Utils.checkDepend(self,module) ){
                                stack.error(1024,id, self.getName(), module.getName());
                            }else{
                                self.extends.push(module);
                                module.used = true;
                                module.children.push(self);
                                this.compilation.addDependency(module,self);
                            }
                        }
                    }
                    if(module || !load){
                        push(module, stack)
                    }else if(load){
                        this.compilation.hookAsync('compilation.create.done', ()=>{
                            push(stack.getReferenceModuleType(), stack)
                        })
                    }
                }))
            }

            this.node.body.map( item=>{
                const stack = this.createTokenStack( compilation, item, this.scope, this.node, this);
                if( stack ){
                    if( stack.isMetatypeDeclaration ){
                        metatypes.push( stack );
                    }else if( stack.isAnnotationDeclaration ){
                        annotations.push( stack );
                    }else{
                        stack.metatypes   = metatypes.splice(0,metatypes.length);
                        stack.annotations = annotations.splice(0,annotations.length);
                        this.body.push(stack);
                    }
                }
            });

        }catch(e){
            this.compilation.throwError(e);
        }
    }
    
    type(){
        return this.module;
    }

    description(){
        return this;
    }

    parser(){
        if(super.parser()===false)return false;
        try{
            const cache = {};
            this.extends.forEach(item=>{
                item.parser();
                item.setRefBeUsed();
            })
            this.body.forEach(item=>{
                if(!item)return;
                item.parser();
                if( !(item.isIdentifier || item.isMemberExpression) ){
                    if( item.isStructTableKeyDefinition && item.local?.isStructTableMethodDefinition ){
                        const key = item.local?.key?.value();
                        if( cache[key] ){
                            cache[key].error(1168);
                            item.local.key.error(1168);
                        }
                        cache[key] = item.local.key;
                    }
                }
            });
        }catch(e){
            this.compilation.throwError(e);
        }
    }

    value(){
        return this.id.value();
    }
}

module.exports = StructTableDeclaration;