const Namespace = require("../core/Namespace");
const Utils = require("../core/Utils");
const GenericType = require("./GenericType");
const {createHash} = require('crypto');
class InferGenericType extends GenericType{
    #unikey = null;
    constructor(target){
        super(target);
        this.id = '$InferGenericType'
        this.isInferGenericType=true;
    }
    getUniKey(){
        const exists = this.#unikey;
        if(exists)return exists;
        const target = this.target;
        const ns = target.namespace.toString()
        let parent = target.getParentStack(
            stack=>stack.isFunctionExpression || 
            stack.isTypeFunctionDefinition || 
            stack.isParamDeclarator || 
            stack.isProperty || 
            stack.isGenericTypeDeclaration || 
            stack.isGenericTypeAssignmentDeclaration || 
            stack.isClassDeclaration || 
            stack.isDeclaratorDeclaration || 
            stack.isInterfaceDecorator || 
            stack.isDeclaratorTypeAlias
        );
        let classId = null;
        let methodKey = null;
        let descIndex = null;
        let paramIndex = null;
        if(target.module){
            classId = target.module.id;
        }
        if(parent.isParamDeclarator){
            paramIndex = 'p'+ parent.parentStack.params.indexOf(parent);
            parent = parent.parentStack;
        }else if(parent.isGenericTypeDeclaration || parent.isGenericTypeAssignmentDeclaration){
            paramIndex = 'g'+parent.parentStack.elements.indexOf(parent);
            parent = parent.parentStack.parentStack;
        }else if(parent.isProperty){
            paramIndex = parent.key.value();
            const _parent = target.getParentStack(
                stack=>stack.isFunctionExpression ||
                stack.isDeclaratorFunction ||
                stack.isClassDeclaration || 
                stack.isDeclaratorDeclaration || 
                stack.isDeclaratorTypeAlias || 
                stack.isInterfaceDecorator
            );
            if(_parent){
                parent = _parent;
            }
        }

        if(parent.isCallDefinition || parent.isNewDefinition){
            const descriptors = parent.module.descriptors.get(parent.isNewDefinition ? 'constructor' : '#'+parent.module.id);
            if(descriptors){
                descIndex = 'd'+descriptors.indexOf(parent);
            }
        }

        if(parent.isFunctionExpression && parent.parentStack.isMethodDefinition){
            parent = parent.parentStack;
            methodKey = parent.key.value();
        }else if(parent.isDeclaratorFunction){
            methodKey = parent.key.value();
        }

        if(parent.isDeclaratorTypeAlias){
            classId = parent.id
        }
        const hash = createHash("sha256").update(target.file||target.compilation.source).digest("hex").substring(0, 16);
        const key = [hash, ns, classId, descIndex, methodKey,paramIndex].filter(Boolean).join('-')
        return this.#unikey = 'infer::'+key;
    }

    getInferResult(context, records){
        let target = this.target;
        if(target.expression){
            return target.expression.type().getInferResult(context, records)
        }else{
            let result = null;
            if(records){
                result = records.get(this)
            }
            return result || context.fetch(this) || Namespace.globals.get('unknown');
        }
    }

    is(type, context){
        if(Utils.isContext(context)){
            const result = this.getInferResult(context);
            if(result){
                return result.is(type, context)
            }
        }
        return false;
    }

    toString(context, options={}){
        const target = this.target;
        const parts = [];
        parts.push('infer ', target.argument.value());
        if(target.expression){
            parts.push(` extends ${target.expression.type().toString(context, options)}`);
        }
        return parts.join('');
    }
}
module.exports = InferGenericType;