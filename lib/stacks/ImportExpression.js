const Stack = require("../core/Stack");
class ImportExpression extends Stack{
	constructor(compilation,node,scope,parentNode,parentStack){
		super(compilation,node,scope,parentNode,parentStack);
		this.isImportExpression = true;
		this.source = this.createTokenStack( compilation, node.source, scope, node,this );
		this.compilation.hookAsync('compilation.create.after',async ()=>{
			if( this.source.isLiteral ){
				await this.getResolveCompilationAsync();
			}else{
				const desc = await this.loadTypeAsync(this.source.value());
				if(desc && desc.isModule){
					this.compilation.addDependency(desc, this.module);
				}
			}
        });
	}

	freeze(){
		super.freeze(this);
		super.freeze(this.source);
	}

	definition(ctx){
		const context = this.description();
		if( context && context.isType && context.isModule && (context.isClass || context.isDeclarator || context.isInterface) ){
			return context.definition(ctx);
		}
	}

	description(){
		if( this.source ){
			if( this.source.isLiteral ){
				const compilation = this.getResolveCompilation();
				if(compilation && compilation.modules.size > 0){
                    return compilation.mainModule;
				}
			}else{
				return this.getModuleById( this.source.value() );
			}
		}
		return null;
	}

	getResolveFile(){
		return this.getAttribute('getResolveFile',()=>{
			const id = this.source.isLiteral ? this.source.value() : this.source.value().replace('.', '/');
			const resolve = this.resolve = this.compiler.resolveManager.resolveFile(
				id, 
				id.includes('.') ? id : this.compilation.file
			);
			if( !resolve ){
				this.source.error(1122, this.source.value());
			}
			return resolve;
		})
	}

	getResolveCompilation(){
		return this.getAttributeAlways('resolveCompilation');
	}

	async getResolveCompilationAsync(){
		if(this.hasAttributeAlways('resolveCompilation')){
            return this.getAttributeAlways('resolveCompilation')
        }
		let compilation = null;
		if( this.compiler.checkFileExt(this.getResolveFile()) ){
			compilation = await this.compilation.createChildCompilation(this.getResolveFile(), this.compilation.file);
			if( !compilation ){
				this.source.error(1132, this.source.value() );
			}else{
				if(this.compilation.isDescriptorDocument()){
					compilation.once('onRemoved',()=>{
						this.removeAttributeAlways('resolveCompilation')
						this.compiler.printLogInfo(`onRemoved: ${this.toString()}: getResolveCompilationAsync: ${compilation.file}`, 'Stack')
					})
                }
				if(compilation.mainModule){
					this.compilation.addDependency(compilation.mainModule, this.module);
				}else{
					this.compilation.addDependency(compilation);
				}
				compilation.import = 'importSpecifier';
			}
		}
		this.setAttributeAlways('resolveCompilation', compilation);
		return compilation;
	}

	parser(){
		if(super.parser()===false)return false;
		if( this.source ){
			const module = this.description();
			if( !module  ){
				if( this.compiler.checkFileExt(this.getResolveFile()) ){
					const file = this.source.value();
					if( file ){
						this.source.error(1026, this.source.value() );
					}else{
						this.source.error(1060, this.source.value() );
					}
				}
			}else{
				module.used = true;
				this.compilation.addDependency(module, this.module);
			}
		}else{
			this.error(1000, 1, 0);
		}
	}

	type(){
		return this.description() || this.getGlobalTypeById('any');
	}

	value(){
		return this.source.value();
	}
	
	raw(){
		return this.source.raw();
	}
}

module.exports = ImportExpression;
