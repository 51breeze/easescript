const tokens={};
const Stack=require('./core/Stack.js');
const create=function(compilation,node,scope,parentNode,parentStack){
    if( !node ){
        return null;
    }
    switch( node.type ){
        case "MethodDefinition":
            if( node.kind === "get"){
                return new tokens.MethodGetterDefinition(compilation,node,scope,parentNode,parentStack);
            }else if( node.kind === "set"){
                return new tokens.MethodSetterDefinition(compilation,node,scope,parentNode,parentStack);
            }
            return new tokens.MethodDefinition(compilation,node,scope,parentNode,parentStack);
        case "Super":
            return new tokens.SuperExpression(compilation,node,scope,parentNode,parentStack);
        default :
            const stackClass = tokens[ node.type ];
            if( stackClass ){
                return new stackClass(compilation,node,scope,parentNode,parentStack);
            }else{
                compilation.error(node, 1189, node.type);
            }
    }
};
tokens.AnnotationDeclaration=require('./stacks/AnnotationDeclaration.js');
tokens.AnnotationExpression=require('./stacks/AnnotationExpression.js');
tokens.ArrayExpression=require('./stacks/ArrayExpression.js');
tokens.ArrayPattern=require('./stacks/ArrayPattern.js');
tokens.ArrowFunctionExpression=require('./stacks/ArrowFunctionExpression.js');
tokens.AssignmentExpression=require('./stacks/AssignmentExpression.js');
tokens.AssignmentPattern=require('./stacks/AssignmentPattern.js');
tokens.AwaitExpression=require('./stacks/AwaitExpression.js');
tokens.BinaryExpression=require('./stacks/BinaryExpression.js');
tokens.BlockStatement=require('./stacks/BlockStatement.js');
tokens.BreakStatement=require('./stacks/BreakStatement.js');
tokens.CallDefinition=require('./stacks/CallDefinition.js');
tokens.CallExpression=require('./stacks/CallExpression.js');
tokens.ChainExpression=require('./stacks/ChainExpression.js');
tokens.ClassDeclaration=require('./stacks/ClassDeclaration.js');
tokens.ConditionalExpression=require('./stacks/ConditionalExpression.js');
tokens.ContinueStatement=require('./stacks/ContinueStatement.js');
tokens.Declarator=require('./stacks/Declarator.js');
tokens.DeclaratorDeclaration=require('./stacks/DeclaratorDeclaration.js');
tokens.DeclaratorFunction=require('./stacks/DeclaratorFunction.js');
tokens.DeclaratorTypeAlias=require('./stacks/DeclaratorTypeAlias.js');
tokens.DeclaratorVariable=require('./stacks/DeclaratorVariable.js');
tokens.DoWhileStatement=require('./stacks/DoWhileStatement.js');
tokens.EmptyStatement=require('./stacks/EmptyStatement.js');
tokens.EnumDeclaration=require('./stacks/EnumDeclaration.js');
tokens.EnumProperty=require('./stacks/EnumProperty.js');
tokens.ExportAllDeclaration=require('./stacks/ExportAllDeclaration.js');
tokens.ExportAssignmentDeclaration=require('./stacks/ExportAssignmentDeclaration.js');
tokens.ExportDefaultDeclaration=require('./stacks/ExportDefaultDeclaration.js');
tokens.ExportNamedDeclaration=require('./stacks/ExportNamedDeclaration.js');
tokens.ExportSpecifier=require('./stacks/ExportSpecifier.js');
tokens.Expression=require('./stacks/Expression.js');
tokens.ExpressionStatement=require('./stacks/ExpressionStatement.js');
tokens.ForInStatement=require('./stacks/ForInStatement.js');
tokens.ForOfStatement=require('./stacks/ForOfStatement.js');
tokens.ForStatement=require('./stacks/ForStatement.js');
tokens.FunctionDeclaration=require('./stacks/FunctionDeclaration.js');
tokens.FunctionExpression=require('./stacks/FunctionExpression.js');
tokens.GenericDeclaration=require('./stacks/GenericDeclaration.js');
tokens.GenericTypeAssignmentDeclaration=require('./stacks/GenericTypeAssignmentDeclaration.js');
tokens.GenericTypeDeclaration=require('./stacks/GenericTypeDeclaration.js');
tokens.Identifier=require('./stacks/Identifier.js');
tokens.IfStatement=require('./stacks/IfStatement.js');
tokens.ImportDeclaration=require('./stacks/ImportDeclaration.js');
tokens.ImportDefaultSpecifier=require('./stacks/ImportDefaultSpecifier.js');
tokens.ImportExpression=require('./stacks/ImportExpression.js');
tokens.ImportNamespaceSpecifier=require('./stacks/ImportNamespaceSpecifier.js');
tokens.ImportSpecifier=require('./stacks/ImportSpecifier.js');
tokens.InterfaceDeclaration=require('./stacks/InterfaceDeclaration.js');
tokens.JSXAttribute=require('./stacks/JSXAttribute.js');
tokens.JSXCdata=require('./stacks/JSXCdata.js');
tokens.JSXClosingElement=require('./stacks/JSXClosingElement.js');
tokens.JSXClosingFragment=require('./stacks/JSXClosingFragment.js');
tokens.JSXElement=require('./stacks/JSXElement.js');
tokens.JSXEmptyExpression=require('./stacks/JSXEmptyExpression.js');
tokens.JSXExpressionContainer=require('./stacks/JSXExpressionContainer.js');
tokens.JSXFragment=require('./stacks/JSXFragment.js');
tokens.JSXIdentifier=require('./stacks/JSXIdentifier.js');
tokens.JSXMemberExpression=require('./stacks/JSXMemberExpression.js');
tokens.JSXNamespacedName=require('./stacks/JSXNamespacedName.js');
tokens.JSXOpeningElement=require('./stacks/JSXOpeningElement.js');
tokens.JSXOpeningFragment=require('./stacks/JSXOpeningFragment.js');
tokens.JSXScript=require('./stacks/JSXScript.js');
tokens.JSXSpreadAttribute=require('./stacks/JSXSpreadAttribute.js');
tokens.JSXStyle=require('./stacks/JSXStyle.js');
tokens.JSXText=require('./stacks/JSXText.js');
tokens.LabeledStatement=require('./stacks/LabeledStatement.js');
tokens.Literal=require('./stacks/Literal.js');
tokens.LogicalExpression=require('./stacks/LogicalExpression.js');
tokens.MemberExpression=require('./stacks/MemberExpression.js');
tokens.MetatypeDeclaration=require('./stacks/MetatypeDeclaration.js');
tokens.MethodDefinition=require('./stacks/MethodDefinition.js');
tokens.MethodGetterDefinition=require('./stacks/MethodGetterDefinition.js');
tokens.MethodSetterDefinition=require('./stacks/MethodSetterDefinition.js');
tokens.ModifierDeclaration=require('./stacks/ModifierDeclaration.js');
tokens.ModuleDeclaration=require('./stacks/ModuleDeclaration.js');
tokens.NamespaceDeclaration=require('./stacks/NamespaceDeclaration.js');
tokens.NewDefinition=require('./stacks/NewDefinition.js');
tokens.NewExpression=require('./stacks/NewExpression.js');
tokens.ObjectExpression=require('./stacks/ObjectExpression.js');
tokens.ObjectPattern=require('./stacks/ObjectPattern.js');
tokens.PackageDeclaration=require('./stacks/PackageDeclaration.js');
tokens.ParenthesizedExpression=require('./stacks/ParenthesizedExpression.js');
tokens.Program=require('./stacks/Program.js');
tokens.Property=require('./stacks/Property.js');
tokens.PropertyDefinition=require('./stacks/PropertyDefinition.js');
tokens.RestElement=require('./stacks/RestElement.js');
tokens.ReturnStatement=require('./stacks/ReturnStatement.js');
tokens.SequenceExpression=require('./stacks/SequenceExpression.js');
tokens.SpreadElement=require('./stacks/SpreadElement.js');
tokens.StructTableColumnDefinition=require('./stacks/StructTableColumnDefinition.js');
tokens.StructTableDeclaration=require('./stacks/StructTableDeclaration.js');
tokens.StructTableKeyDefinition=require('./stacks/StructTableKeyDefinition.js');
tokens.StructTableMethodDefinition=require('./stacks/StructTableMethodDefinition.js');
tokens.StructTablePropertyDefinition=require('./stacks/StructTablePropertyDefinition.js');
tokens.SuperExpression=require('./stacks/SuperExpression.js');
tokens.SwitchCase=require('./stacks/SwitchCase.js');
tokens.SwitchStatement=require('./stacks/SwitchStatement.js');
tokens.TemplateElement=require('./stacks/TemplateElement.js');
tokens.TemplateLiteral=require('./stacks/TemplateLiteral.js');
tokens.ThisExpression=require('./stacks/ThisExpression.js');
tokens.ThrowStatement=require('./stacks/ThrowStatement.js');
tokens.TryStatement=require('./stacks/TryStatement.js');
tokens.TypeAssertExpression=require('./stacks/TypeAssertExpression.js');
tokens.TypeComputeDefinition=require('./stacks/TypeComputeDefinition.js');
tokens.TypeDefinition=require('./stacks/TypeDefinition.js');
tokens.TypeFunctionDefinition=require('./stacks/TypeFunctionDefinition.js');
tokens.TypeGenericDefinition=require('./stacks/TypeGenericDefinition.js');
tokens.TypeIntersectionDefinition=require('./stacks/TypeIntersectionDefinition.js');
tokens.TypeKeyofDefinition=require('./stacks/TypeKeyofDefinition.js');
tokens.TypeObjectDefinition=require('./stacks/TypeObjectDefinition.js');
tokens.TypeObjectPropertyDefinition=require('./stacks/TypeObjectPropertyDefinition.js');
tokens.TypePredicateDefinition=require('./stacks/TypePredicateDefinition.js');
tokens.TypeStatement=require('./stacks/TypeStatement.js');
tokens.TypeTransformExpression=require('./stacks/TypeTransformExpression.js');
tokens.TypeTupleDefinition=require('./stacks/TypeTupleDefinition.js');
tokens.TypeTupleElementDefinition=require('./stacks/TypeTupleElementDefinition.js');
tokens.TypeTupleRestDefinition=require('./stacks/TypeTupleRestDefinition.js');
tokens.TypeTupleUnionDefinition=require('./stacks/TypeTupleUnionDefinition.js');
tokens.TypeTypeofDefinition=require('./stacks/TypeTypeofDefinition.js');
tokens.TypeUnionDefinition=require('./stacks/TypeUnionDefinition.js');
tokens.TypeUniqueDefinition=require('./stacks/TypeUniqueDefinition.js');
tokens.UnaryExpression=require('./stacks/UnaryExpression.js');
tokens.UpdateExpression=require('./stacks/UpdateExpression.js');
tokens.UseExtendSpecifier=require('./stacks/UseExtendSpecifier.js');
tokens.UseExtendStatement=require('./stacks/UseExtendStatement.js');
tokens.VariableDeclaration=require('./stacks/VariableDeclaration.js');
tokens.VariableDeclarator=require('./stacks/VariableDeclarator.js');
tokens.WhenStatement=require('./stacks/WhenStatement.js');
tokens.WhileStatement=require('./stacks/WhileStatement.js');
for(var name in tokens){
    tokens[name].prototype.toString=(function(name){
        return function(){return name};
    }(name));
}
Stack.create=create;
module.exports={'tokens':tokens,'create':create};