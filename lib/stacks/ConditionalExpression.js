const Expression = require("./Expression");
const MergeType = require("../core/MergeType");
const BlankScope = require("../scope/BlankScope");
class ConditionalExpression extends Expression{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isConditionalExpression= true;
        const _scope1 = node.consequent?.type ==='BlockStatement' ? scope : new BlankScope(scope);
        const _scope2 = node.alternate?.type ==='BlockStatement' ? scope : new BlankScope(scope);
        this.test = this.createTokenStack( compilation, node.test, scope, node, this );
        this.consequent = this.createTokenStack( compilation, node.consequent, _scope1, node,this );
        this.alternate = this.createTokenStack( compilation, node.alternate, _scope2, node,this );
    }
    freeze(){
        super.freeze();
        this.consequent.freeze();
        this.alternate.freeze();
    }
    definition(){
        return null;
    }
    reference(){
        return this;
    }
    referenceItems(){
        return this.consequent.referenceItems().concat( this.alternate.referenceItems() );
    }
    description(){
        return this;
    }
    
    type(){
        return this.getAttribute('ConditionalExpression.type',()=>{
            const mergeType = new MergeType();
            if(!this.hasNestDescription(this.consequent)){
                mergeType.add(this.consequent.type());
            }
            if(!this.hasNestDescription(this.alternate)){
                mergeType.add(this.alternate.type());
            }
            return mergeType.type();
        });
    }

    // getContext(){
    //     return this.getAttribute('getContext', ()=>{
    //         const type = this.type()
    //         if(type.isInstanceofType && type.isThisType){
    //             const module = type.inherit.type()
    //             if(Utils.isModule(module)){
    //                 const moduleStack = module.getInheritContextStack(this.compilation);
    //                 if(moduleStack){
    //                     const parent = moduleStack.getContext();
    //                     return parent.createChild(this);
    //                 }
    //             }
    //         }
    //         return super.getContext()
    //     });
    // }
    
    parser(){
        if(super.parser()===false)return false;
        this.parseConditionState(this.test)
        this.test.parser();
        this.test.setRefBeUsed();
        this.consequent.parser();
        this.consequent.setRefBeUsed();
        this.alternate.parser();
        this.alternate.setRefBeUsed();
    }
}

module.exports = ConditionalExpression;