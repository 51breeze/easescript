const Expression = require("./Expression");
class AssignmentExpression extends Expression{
    constructor(compilation,node,scope,parentNode,parentStack){
        super(compilation,node,scope,parentNode,parentStack);
        this.isAssignmentExpression=true;
        this.left = this.createTokenStack( compilation, node.left, scope, node ,this);
        this.right = this.createTokenStack( compilation, node.right, scope, node ,this);
        this.left.accessor = "set";
        this.operator = node.operator;
    }
    freeze(){
        super.freeze();
        this.left.freeze();
        this.right.freeze();
    }
    definition(context){
        return this.left.definition( context );
    }
    description(){
        const desc = this.left.description();
        if( desc && desc.isPropertyDefinition ){
            return desc.description();
        }
        return desc;
    }
    type(ctx){
        return this.right.type(ctx);
    }
    async parser(){
        return await this.callParser(async ()=>{
            await this.left.parser();
            await this.right.parser();
            this.left.setRefBeUsed();
            this.right.setRefBeUsed();
            let desc = this.description();
            if( desc && desc.isComputeType ){
                desc = this.left.type();
                this.checkExpressionType(desc, this.right)
            }
            else if( desc && !desc.isAnyType ){
                let identi = this.left;
                if( identi.isMemberExpression ){
                    identi = identi.property;
                }

                if( this.left.isArrayPattern || this.left.isObjectPattern){

                    //todo...

                }else{

                    if( desc.kind ==="const" || !desc.assignment ){
                        if( desc.isTypeObjectPropertyDefinition ){
                            this.checkExpressionType(desc, this.right, identi);
                        }else{
                            if( !this.left.isMemberExpression ){
                                this.error(1015,this.left.value());
                            }
                        }
                    }else{
                        desc.assignment(this.right, identi);
                    }
                }
            }
        })
    }
    value(){
        return this.left.value();
    }
    raw(){
        return this.left.raw();
    }
}

module.exports = AssignmentExpression;