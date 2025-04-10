const Namespace = require("../core/Namespace");
const Expression = require("./Expression");
class SuperExpression  extends Expression {
    constructor(compilation,node,scope,parentNode,parentStack){ 
        super(compilation,node,scope,parentNode,parentStack);
        this.isSuperExpression= true;
        const fnScope = scope.getScopeByType("function");
        if( fnScope.isMethod && fnScope.isConstructor && !fnScope.hasSuper ){
            fnScope.firstSuperIndex = parentStack.childrenStack.length;
            fnScope.hasSuper = true;
        }
    }
    definition(ctx){
        let parent = this.module.getInheritModule();
        if(parent)parent = parent.type();
        const methodConstructor = parent && parent.getConstructMethod();
        if( methodConstructor ){
            parent = methodConstructor;
        }
        return parent && parent.definition(ctx);
    }
    reference(){
        return this;
    }
    referenceItems(){
        return [this];
    }
    description(){
        // if( !this.parentStack.isMemberExpression ){
        //    let parent = this.module.extends[0];
        //    if(parent)parent = parent.type();
        //    const methodConstructor = parent && parent.getConstructMethod();
        //    if( methodConstructor ){
        //        return methodConstructor;
        //    }else if(parent){
        //        return parent;
        //    }
        // }
        return this;
    }

    // getContext(){
    //     let ctx = this.getAttribute('getContext');
    //     if(ctx)return ctx;
    //     const module = this.module;
    //     const moduleStack = module.moduleStack;
    //     const parent = moduleStack.getContext();
    //     return this.setAttribute('getContext',parent.createChild(this));
    // }

    type(){
        const inherit = this.module.getInheritModule();
        if( inherit ){
            return inherit;
        }
        return Namespace.globals.get('never');
    }
    parser(){
        if(super.parser()===false)return false;
        const stack = this.getParentStack( (stack)=>{
            return !!stack.isFunctionExpression;
        });
        if( !stack || !(stack.parentStack.isMethodDefinition) || stack.parentStack.static){
            this.error(1076)
        }
        const parent = this.module && this.module.getInheritModule();
        if( !parent ){
            this.error(1075);
        }
    }
    value(){
        return `super`;
    }
    raw(){
        return `super`; 
    }
}

module.exports = SuperExpression;