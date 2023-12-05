const Expression = require("./Expression");
const MergeType = require("../core/MergeType");
class ConditionalExpression extends Expression{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isConditionalExpression= true;
        this.test = this.createTokenStack( compilation, node.test, scope, node,this );
        this.consequent = this.createTokenStack( compilation, node.consequent, scope, node,this );
        this.alternate = this.createTokenStack( compilation, node.alternate, scope, node,this );
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
            mergeType.add( this.consequent.type() );
            mergeType.add( this.alternate.type() );
            return mergeType.type();
        });
    }
    async parser(){
        return await this.callParser(async ()=>{
            await this.test.parser();
            this.test.setRefBeUsed();
            await this.consequent.parser();
            this.consequent.setRefBeUsed();
            await this.alternate.parser();
            this.alternate.setRefBeUsed();
        })
    }
}

module.exports = ConditionalExpression;