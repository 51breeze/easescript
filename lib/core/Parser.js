const acorn = require("acorn");
const jsx = require("acorn-jsx");
const
    SCOPE_TOP = 1,
    SCOPE_FUNCTION = 2,
    SCOPE_VAR = SCOPE_TOP | SCOPE_FUNCTION,
    SCOPE_ASYNC = 4,
    SCOPE_GENERATOR = 8,
    SCOPE_ARROW = 16,
    SCOPE_SIMPLE_CATCH = 32,
    SCOPE_SUPER = 64,
    SCOPE_DIRECT_SUPER = 128;

 const
    BIND_NONE = 0, 
    BIND_VAR = 1, 
    BIND_LEXICAL = 2,
    BIND_FUNCTION = 3, 
    BIND_SIMPLE_CATCH = 4,
    BIND_OUTSIDE = 5;

const FUNC_STATEMENT = 1, FUNC_HANGING_STATEMENT = 2, FUNC_NULLABLE_ID = 4;

const Parser = acorn.Parser
const TokenType = Parser.acorn.TokenType;
const tokTypes = Parser.acorn.tokTypes;
const keywordTypes = Parser.acorn.keywordTypes;
const tokContexts = Parser.acorn.tokContexts;

const lineBreak = /\r\n?|\n|\u2028|\u2029/;

function functionFlags(async, generator) {
    return SCOPE_FUNCTION | (async ? SCOPE_ASYNC : 0) | (generator ? SCOPE_GENERATOR : 0)
}

function DestructuringErrors() {
    this.shorthandAssign =
    this.trailingComma =
    this.parenthesizedAssign =
    this.parenthesizedBind =
    this.parenthesizedBindParam = 
    this.doubleProto =
      -1;
}

keywordTypes["is"] = new TokenType("is", {beforeExpr: true, binop: 7,keyword:"is"});
tokTypes._is = keywordTypes["is"];

keywordTypes["as"] = new TokenType("as", {beforeExpr: true, binop: 7,keyword:"as"});
tokTypes._as = keywordTypes["as"];

keywordTypes["package"] = new TokenType("package",{startsExpr: true,keyword:"package"});
tokTypes._package = keywordTypes["package"];

keywordTypes["implements"] = new TokenType("implements",{startsExpr: true,keyword:"implements"});
tokTypes._implements = keywordTypes["implements"];

keywordTypes["private"] = new TokenType("private",{startsExpr: true,keyword:"private"});
tokTypes._private = keywordTypes["private"];

keywordTypes["protected"] = new TokenType("protected",{startsExpr: true,keyword:"protected"});
tokTypes._protected = keywordTypes["protected"];

keywordTypes["public"] = new TokenType("public",{startsExpr: true,keyword:"public"});
tokTypes._public = keywordTypes["public"];

keywordTypes["internal"] = new TokenType("internal",{startsExpr: true,keyword:"internal"});
tokTypes._internal = keywordTypes["internal"];

keywordTypes["final"] = new TokenType("final",{startsExpr: true,keyword:"final"});
tokTypes._final = keywordTypes["final"];

keywordTypes["static"] = new TokenType("static",{startsExpr: true,keyword:"static"});
tokTypes._static = keywordTypes["static"];

keywordTypes["when"] = new TokenType("when",{startsExpr: true,keyword:"when"});
tokTypes._when = keywordTypes["when"];

keywordTypes["then"] = new TokenType("then",{startsExpr: true,keyword:"then"});
tokTypes._then = keywordTypes["then"];

keywordTypes["enum"] = new TokenType("enum",{startsExpr: true,keyword:"enum"});
tokTypes._enum = keywordTypes["enum"];

keywordTypes["interface"] = new TokenType("interface",{startsExpr: true,keyword:"interface"});
tokTypes._interface = keywordTypes["interface"];

keywordTypes["abstract"] = new TokenType("abstract",{startsExpr: true,keyword:"abstract"});
tokTypes._abstract = keywordTypes["abstract"];

keywordTypes["struct"] = new TokenType("struct",{startsExpr: true,keyword:"struct"});
tokTypes._struct = keywordTypes["struct"];

tokTypes._declarator = new TokenType("declarator",{startsExpr: true,keyword:"declarator"});
tokTypes._annotation = new TokenType("@",{startsExpr: false});

const tokenModifiers = [
    tokTypes._public,
    tokTypes._internal,
    tokTypes._protected,
    tokTypes._private,
    tokTypes._final,
    tokTypes._static,
] 

const JSXParser = Parser.extend( jsx({allowNamespaces:true,allowNamespacedObjects:true}) );
const acornJsx = JSXParser.acornJsx;
const tok = acornJsx.tokTypes;
const tt  = tokTypes;

const tc_type_statement = new acorn.TokContext('disabled-expr-context', false, false);
tc_type_statement.updateContext=function(){
    if( this.curContext() === tc_type_statement){
        this.context.pop();
    }
}

tt.colon.updateContext = function(){
    if( this.curContext() === tc_type_statement){
        this.exprAllowed = false;
    }else if( this.curContext() === tokContexts.b_expr ){
        this.exprAllowed = true;
    }
}

tt.name.updateContext = function(prevType) {
    if(this.context[this.context.length-2] === tc_type_statement || this.curContext() === tc_type_statement){
        this.exprAllowed = false
        return
    }
    var allowed = false;
    if (this.options.ecmaVersion >= 6 && prevType !== tokTypes.dot) {
      if (this.value === "of" && !this.exprAllowed ||
          this.value === "yield" && this.inGeneratorContext())
        { 
            allowed = true;
        }
    }
    this.exprAllowed = allowed;
};

const tc_cdata_expr = new acorn.TokContext('<![CDATA[...]]>', true, true);
const tt_cdata_start = new TokenType('tt_cdata_start', {startsExpr: true});
const tt_cdata_end = new TokenType('tt_cdata_end');
const tt_content_text = new TokenType('cssOrScriptText');
tt_cdata_start.updateContext = function() {
    this.context.push(tc_cdata_expr); 
    this.exprAllowed = false;
};

tt_cdata_end.updateContext = function(prevType) {
    if( this.curContext() === tc_cdata_expr ){
        this.context.pop();
    }
    if( this.curContext() === tc_script_expr ){
        this.context.pop();
    }
    this.exprAllowed = this.curContext() === acornJsx.tokContexts.tc_expr;
};

tt_content_text.updateContext=function(prevType){
    if( this.curContext() === tc_style_expr ){
        this.context.pop();
    }
}

tokTypes.parenR.updateContext = tokTypes.braceR.updateContext = function(prevType) {
    if (this.context.length === 1) {
      this.exprAllowed = true;
      return
    }
    var out = this.context.pop();
    if(this.curContext() === tc_type_statement){
        this.context.pop();
    }
    if (out === tokContexts.b_stat && this.curContext().token === "function") {
        out = this.context.pop();
    }
    if(this.curContext() === tc_type_statement){
        this.exprAllowed = false;
    }else{
        this.exprAllowed = !out.isExpr;
    }
    if( this.context.length===1 && this.context[0] === tokContexts.b_stat){
        this.exprAllowed = true;
    }
};

tokTypes.braceL.updateContext = function(prevType) {
    let ctx = this.braceIsBlock(prevType) ? tokContexts.b_stat : tokContexts.b_expr;
    if(this.disabledJSXExpressionFlag){
        this.disabledJSXExpressionFlag = false;
        this.context.push(tc_type_statement)
    }
    this.context.push(ctx);
    this.exprAllowed = true;
};

tokTypes.parenL.updateContext = function(prevType) {
    var statementParens = prevType === tokTypes._if || prevType === tokTypes._for || prevType === tokTypes._with || prevType === tokTypes._while || prevType === tokTypes._when;
    this.context.push(statementParens ? tokContexts.p_stat : tokContexts.p_expr);
    this.exprAllowed = true;
};


//tokTypes._enum.updateContext = tokTypes._interface.updateContext = tokTypes._struct.updateContext = tokTypes._class.updateContext;

const tc_script_expr = new acorn.TokContext('<script>...</script>', true, false);
const tc_style_expr = new acorn.TokContext('<style>...</style>', true, true);
const tt_whitespace = new TokenType('whitespace');

function getQualifiedJSXName(object) {
    if (!object)
      return object;
  
    if (object.type === 'JSXIdentifier')
      return object.name;
  
    if (object.type === 'JSXNamespacedName')
      return object.namespace.name + ':' + object.name.name;
  
    if (object.type === 'JSXMemberExpression')
      return getQualifiedJSXName(object.object) + '.' +
      getQualifiedJSXName(object.property);
}

class SyntaxParser extends JSXParser {

    constructor(options, input, startPos){
        super(options, input, startPos);
        this.testTokens = [];
        this.stackComments=[];
        this.keywords =  new RegExp( this.keywords.source.replace(")$","|is|package|implements|static|final|public|internal|protected|private|when|then|enum|interface|abstract|struct)$") );
        if( Array.isArray(options.reserved) && options.reserved.length > 0 ){
            this.reservedWords = new RegExp( this.reservedWords.source.replace(")$", "|"+options.reserved.join("|")+")$") );
        }
    }

    next(ignoreEscapeSequenceInKeyword){
        if(this.testTokens.length > 0){
            this.applyTestToken(this.testTokens.shift());
        }else{
            super.next(ignoreEscapeSequenceInKeyword);
        }
    }

    step(){
        this.testTokens.push(this.createTestToken());
        super.next();
        return this.type;
    }

    createTestToken(){
        return {
            type:this.type,
            value:this.value,
            start:this.start,
            startLoc:this.startLoc,
            endLoc:this.endLoc,
            lastTokEnd:this.lastTokEnd,
            lastTokStart:this.lastTokStart,
            lastTokEndLoc:this.lastTokEndLoc,
            lastTokStartLoc:this.lastTokStartLoc,
            pos:this.pos,
            context:this.context.slice(0),
            exprAllowed:this.exprAllowed,
        };
    }

    applyTestToken(token){
        this.pos = token.pos;
        this.type = token.type;
        this.value = token.value;
        this.start = token.start;
        this.startLoc = token.startLoc;
        this.endLoc = token.endLoc;
        this.lastTokEnd = token.lastTokEnd;
        this.lastTokStart = token.lastTokStart;
        this.lastTokEndLoc = token.lastTokEndLoc;
        this.lastTokStartLoc = token.lastTokStartLoc;
        this.context.splice(0,this.context.length,...token.context);
        this.exprAllowed = token.exprAllowed;
    }

    apply(num){
        const len = this.testTokens.length;
        if( num && num < 0 ){
            const index = Math.min( Math.max(len + num,0), len-1 );
            const [node] = this.testTokens.splice(index,1);
            this.testTokens.push(this.createTestToken())
            this.applyTestToken(node);
        }else{
            this.testTokens.length = 0;
        }
    }

    isContextual(name) {
        if( this.parseInterfaceElementFlag && name==="of" ){
            return true;
        }
        return super.isContextual(name);
    };

    parseMaybeConditional(noIn, refDestructuringErrors){
        var startPos = this.start, startLoc = this.startLoc;
        var expr = this.parseExprOps(noIn, refDestructuringErrors);
        if (this.checkExpressionErrors(refDestructuringErrors)) { return expr }
        if (this.eat(tokTypes.question)) {
            if( refDestructuringErrors && refDestructuringErrors.parenthesizedBindParam >= 1 ){
                refDestructuringErrors.parenthesizedBindParam = 2;
                if( this.type === tokTypes.comma || this.type === tokTypes.parenR ){
                    refDestructuringErrors.parenthesizedBindParam = 3;
                    expr.question = true;
                    return expr;
                }else if( this.type === tokTypes.colon ){
                    this.next();
                    refDestructuringErrors.parenthesizedBindParam = 3;
                    expr.question = true;
                    expr.acceptType = this.parseTypeDefinition();
                    return expr;
                }
            }
            var node = this.startNodeAt(startPos, startLoc);
            node.test = expr;
            node.consequent = this.parseMaybeAssign();
            this.expect(tokTypes.colon);
            node.alternate = this.parseMaybeAssign(noIn);
            return this.finishNode(node, "ConditionalExpression")
        }
        return expr
    }
    
    parseParenAndDistinguishExpression(canBeArrow) {
        var startPos = this.start, startLoc = this.startLoc, val, allowTrailingComma = this.options.ecmaVersion >= 8;
        if (this.options.ecmaVersion >= 6) {
            this.next();
            var innerStartPos = this.start, innerStartLoc = this.startLoc;
            var exprList = [], first = true, lastIsComma = false;
            var refDestructuringErrors = new DestructuringErrors, oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, spreadStart;
            refDestructuringErrors.parenthesizedBindParam = 1;
            this.yieldPos = 0;
            this.awaitPos = 0;
            // Do not save awaitIdentPos to allow checking awaits nested in parameters
            while (this.type !== tokTypes.parenR) {
                first ? first = false : this.expect(tokTypes.comma);
                if (allowTrailingComma && this.afterTrailingComma(tokTypes.parenR, true)) {
                    lastIsComma = true;
                    break
                } else if (this.type === tokTypes.ellipsis) {
                    spreadStart = this.start;
                    exprList.push(this.parseParenItem(this.parseRestBinding()));
                    if (this.type === tokTypes.comma) { 
                        this.raise(this.start, "Comma is not permitted after the rest element");
                    }
                    break
                } else {
                    exprList.push(this.parseMaybeAssign(false, refDestructuringErrors, this.parseParenItem));
                }
            }

            var innerEndPos = this.start, innerEndLoc = this.startLoc;
            this.expect(tokTypes.parenR);

            let returnType = null;
            if( canBeArrow && this.eat( tokTypes.colon ) ){
                returnType = this.parseTypeDefinition();
            }

            if (canBeArrow && !this.canInsertSemicolon() && this.eat(tokTypes.arrow)) {
                this.checkPatternErrors(refDestructuringErrors, false);
                this.checkYieldAwaitInDefaultParams();
                this.yieldPos = oldYieldPos;
                this.awaitPos = oldAwaitPos;
                const node = this.parseParenArrowList(startPos, startLoc, exprList);
                node.returnType = returnType;
                return node;
            }
            if( returnType ){
                this.unexpected( returnType.start );
            }
            if (!exprList.length || lastIsComma) { this.unexpected(this.lastTokStart); }
            if (spreadStart) { this.unexpected(spreadStart); }
            this.checkExpressionErrors(refDestructuringErrors, true);
            this.yieldPos = oldYieldPos || this.yieldPos;
            this.awaitPos = oldAwaitPos || this.awaitPos;

            if (exprList.length > 1) {
                val = this.startNodeAt(innerStartPos, innerStartLoc);
                val.expressions = exprList;
                this.finishNodeAt(val, "SequenceExpression", innerEndPos, innerEndLoc);
            } else {
                val = exprList[0];
            }
        } else {
            val = this.parseParenExpression();
        }

        var par = this.startNodeAt(startPos, startLoc);
        par.expression = val;
        if( val.type !=="SequenceExpression" && !this.canInsertSemicolon() && (this.type === tokTypes._this || this.type === tokTypes.name ) ){
            startPos = this.start, startLoc = this.startLoc;
            par.value= this.parseSubscripts(this.parseExprAtom(), startPos, startLoc);
            val = this.finishNode(par, "TypeTransformExpression");
        }else{
            val = this.finishNode(par, "ParenthesizedExpression");
        }
        return val;
    }

    parseExprAtom(refDestructuringErrors){
        if( this.type === tokTypes._annotation ){
            return this.parseAnnotation( true );
        }
        if(this._exportAssignmentDeclaration){
            if(tokTypes._internal === this.type || tokTypes._package === this.type || tokTypes._struct === this.type || tokTypes._when === this.type || tokTypes._then === this.type ){
                return this.parseIdent(false);
            }
        }
        return super.parseExprAtom(refDestructuringErrors);
    }

    parseParenItem(item){
        if( super.eat( tokTypes.colon ) ){
            item.acceptType = this.parseTypeDefinition();
        }
        return item;
    }

    readToken( code ){
        const context = this.curContext();
        if( context === tc_style_expr ){
            return this.jsx_readCDATAToken(code) ||  this.jsx_readTextToken('style');
        }

        if(code===60 && (this.disabledJSXExpressionFlag || this.__parseTypeStatement || this.parseDeclaratorContext || this.parseInterfaceContext)){
            return super.readToken_lt_gt(code)
        }

        //@
        if( code === 64 ){
            ++this.pos; 
            return this.finishToken(tokTypes._annotation);
        }
       
        if( context === tc_script_expr ){
            return this.jsx_readCDATAToken(code) || super.readToken( code );
        }else if( context === tc_cdata_expr ){
            return this.jsx_readTextToken();
        }else if( !this.jsx_readCDATAToken(code) ){
            if( !this.exprAllowed && this.curContext() === acornJsx.tokContexts.tc_expr ){
                this.exprAllowed = true;
            }
            return super.readToken(code);
        }
    }

    finishToken(type, word){
        if( tokTypes.string !== type && word === "as" ){
            type = tokTypes._as;
        }
        return super.finishToken(type, word);
    }

    initFunction(node){
        if( this.type === tokTypes.star ){
            this.raise( this.lastTokStart, `Function generator unsupported`);
        }
        super.initFunction(node);
    }

    parseClassSuper(node){
        node.superClass = null;
        if( this.eat(tokTypes._extends) ){
            if( this.isStaticClass ){
                this.raise(this.lastTokStart,"Static class cannot extends super class.");
            }
            node.superClass = this.parseChainIdentifier();
            if( node.superClass ){
                node.superClass.genericity = this.getGenerics(true); 
            }
        }
        
        node.implements = null;
        if( this.eat(tokTypes._implements) ){
            if( this.isStaticClass ){
                this.raise(this.lastTokStart,"Static class cannot implements interfaces.");
            }
            node.implements = [];
            do{ 
                const imp =  this.parseChainIdentifier();
                if( imp ){
                    imp.genericity = this.getGenerics(true);
                }
                node.implements.push( imp );
            }while( this.eat(tokTypes.comma) );
        }
    }

    parseClassId(node, isStatement){
        if(this.type === tokTypes._internal){
            node.id = this.parseIdent();
        }else{
            super.parseClassId(node, isStatement);
        }
        node.genericity = this.parseGenericType();
    }

    parseMethod(isGenerator, isAsync, allowDirectSuper){
        const generics = this.parseGenericType();
        const node = super.parseMethod(isGenerator, isAsync, allowDirectSuper);
        node.genericity = generics;
        return node;
    }

    parseFunctionParams(node){
        node.genericity = this.parseGenericType();
        super.parseFunctionParams(node);
    }

    parseBlock(createNewLexicalScope, node){
        if ( createNewLexicalScope === void 0 ){
            createNewLexicalScope = true;
        } 
        if ( node === void 0 ) {
            node = this.startNode();
        }
        const scope = this.currentScope();
        switch( scope.flags & SCOPE_FUNCTION ){
            case SCOPE_ARROW :
            case SCOPE_FUNCTION :
            case SCOPE_ASYNC :
            case SCOPE_GENERATOR :
                if( this.eat( tokTypes.colon ) ){
                   node.acceptType = this.parseTypeDefinition();
                }
                break;
        }
        return super.parseBlock(createNewLexicalScope, node);
    }

    checkUnreserved(ref){
        if( this.__parseBindingAtom && ref.name !=='default' ){
           super.checkUnreserved(ref);
        }
    }

    parseBindingAtom(){
        this.__parseBindingAtom=true
        const node = this.type === tokTypes._this ? this.parseIdent(true) : super.parseBindingAtom();
        this.__parseBindingAtom=false;
        if(!this.__parseVarIdFlag){
            if( this.eat( tokTypes.question ) ){
                node.question = true;
            }
            if( this.eat( tokTypes.colon ) ){
                node.acceptType =  this.parseTypeDefinition();
            }
        }
        return node;
    }

    parseVarId(decl, kind){
        this.__parseVarIdFlag = true;
        super.parseVarId(decl, kind);
        this.__parseVarIdFlag = false;
        if( this.eat( tokTypes.colon ) ){
            decl.acceptType = this.parseTypeDefinition();
        }
    }

    parsePropertyValue(prop, isPattern, isGenerator, isAsync, startPos, startLoc, refDestructuringErrors, containsEsc){
        // if( isPattern && this.eat( tokTypes.colon ) ){
        //    prop.acceptType = this.parseTypeStatement();
        // }
       const generics = this.parseGenericType();
       super.parsePropertyValue(prop, isPattern, isGenerator, isAsync, startPos, startLoc, refDestructuringErrors, containsEsc);
       if( prop.value && prop.value.type==="FunctionExpression"){
           prop.value.genericity = generics;
       }else if( generics ){
           this.unexpected( generics.start )
       }
    }

    parseMaybeAssign(noIn, refDestructuringErrors, afterLeftParse){
        const generics = this.parseGenericType();
        const node = super.parseMaybeAssign(noIn, refDestructuringErrors, afterLeftParse);
        if( node.type==="ArrowFunctionExpression"){
            node.genericity = generics;
        }else if( generics ){
            this.unexpected( generics.start )
        }
        return node;
    }

    parseArrowExpression(node, params, isAsync){
        let type = null;
        if( this.arrowReturnType && this.arrowReturnType[ this.lastTokStart ] ){
            type = this.arrowReturnType[  this.lastTokStart ];
            delete this.arrowReturnType[ this.lastTokStart ];
        }
        const fn = super.parseArrowExpression( node, params, isAsync );
        fn.returnType = type;
        return fn;
    }

    parseFunctionBody(node, isArrowFunction, isMethod){
        if( !isArrowFunction && this.type === tokTypes.colon ){
            this.next();
            node.returnType = this.parseTypeDefinition(); 
        }
        if( this.parseInterfaceElementFlag || this.parseDeclareModuleContext ){
            this.parseInterfaceElementFlag = false;
            this.semicolon();
            this.checkParams(node);
            this.exitScope();
            return node;
        }
        super.parseFunctionBody(node, isArrowFunction, isMethod);
    }

    parseNew() {
        if (this.containsEsc) { this.raiseRecoverable(this.start, "Escape sequence in keyword new"); }
        var node = this.startNode();
        var meta = this.parseIdent(true);
        if (this.options.ecmaVersion >= 6 && this.eat(tokTypes.dot)) {
          node.meta = meta;
          var containsEsc = this.containsEsc;
          node.property = this.parseIdent(true);
          if (node.property.name !== "target")
            { this.raiseRecoverable(node.property.start, "The only valid meta property for new is 'new.target'"); }
          if (containsEsc)
            { this.raiseRecoverable(node.start, "'new.target' must not contain escaped characters"); }
          if (!this.inNonArrowFunction())
            { this.raiseRecoverable(node.start, "'new.target' can only be used in functions"); }
          return this.finishNode(node, "MetaProperty")
        }
        var startPos = this.start, startLoc = this.startLoc, isImport = this.type === tokTypes._import;
        node.callee = this.parseSubscripts(this.parseExprAtom(), startPos, startLoc, true);
        if (isImport && node.callee.type === "ImportExpression") {
          this.raise(startPos, "Cannot use new with import()");
        }
        startPos = this.start;
        node.genericity = this.getGenerics(true);
        if( node.genericity && !(node.genericity.length > 0) ){
            this.raise(startPos, "Missing generics arguments.");
        }
        if (this.eat(tokTypes.parenL)) { node.arguments = this.parseExprList(tokTypes.parenR, this.options.ecmaVersion >= 8, false); }
        else { node.arguments = []; }
        return this.finishNode(node, "NewExpression");
    }

    parseSubscript(base, startPos, startLoc, noCalls, maybeAsyncArrow, optionalChained){
        const _startPos = this.start;
        const generics = !noCalls ? this.getGenerics(false) : null;
        const start = this.start;
        const node = super.parseSubscript(base, startPos, startLoc, noCalls, maybeAsyncArrow, optionalChained);
        if( node.type==="CallExpression"){
            if(base !== node){
                if( generics && !(generics.length > 0) ){
                    this.raise(_startPos, "Missing generics arguments.");
                }
                node.genericity=generics;
            }else if(generics){
                this.unexpected(start);
            }
        }else if(generics){
            this.raise(start, "'(' expected.");
        }
        return node;
    }

    parseExprOp(left, leftStartPos, leftStartLoc, minPrec, noIn){
        if( this.type === tokTypes._as ){
           this.next();
           const node = this.startNodeAt(leftStartPos, leftStartLoc);
           node.left = left;
           node.right = this.parseTypeDefinition();
           return this.finishNode(node,  "TypeAssertExpression");
        }

        if( this.__parseTypeStatement ){
            if( this.type === tokTypes.bitwiseAND || this.type === tokTypes.bitwiseOR || this.type === tokTypes.comma ){
                return left;
            }
        }

        const endToken = this.__$endToken;
        if(endToken && endToken.length>0){
            const token = endToken[endToken.length-1];
            if(this.type === token.value && this.value.charCodeAt(0) ===token.endCode){
                return left;
            }
        }
        return super.parseExprOp(left, leftStartPos, leftStartLoc, minPrec, noIn);
    }

    parseExpression(noIn, refDestructuringErrors) {
        var startPos = this.start, startLoc = this.startLoc;
        var expr = this.parseMaybeAssign(noIn, refDestructuringErrors);
        if(!this.__parseTypeStatement && this.type === tokTypes.comma) {
          var node = this.startNodeAt(startPos, startLoc);
          node.expressions = [expr];
          while (this.eat(tokTypes.comma)) { node.expressions.push(this.parseMaybeAssign(noIn, refDestructuringErrors)); }
          return this.finishNode(node, "SequenceExpression")
        }
        return expr
    };

    parseStatement(context, topLevel, exports, isDeclaredModule=false){
        switch ( this.type ){
            case tokTypes._package : 
                if( !topLevel || isDeclaredModule){
                    this.unexpected();
                }
                return this.parsePackage( this.startNode(), true );
            case tokTypes._abstract : 
                if( !topLevel ){
                    this.unexpected();
                }
                var abstract = this.startNode();
                abstract.name = "abstract";
                this.next();
                if( this.type !== tokTypes._class ){
                    this.unexpected();
                }
                this.finishNode(abstract,"ModifierDeclaration")
                var node = this.parseClass(this.startNode(), true);
                node.abstract = abstract;
                return node;
            case tokTypes._public : 
                if( !topLevel ){
                    this.unexpected();
                }
                this.next();
                var modifier = this.finishNode(this.startNode(),"ModifierDeclaration");
                modifier.name = "public";
                var node = this.parseStatement(null, topLevel, exports);
                node.modifier = modifier;
                return node;
            case tokTypes._internal : 
                if( !topLevel ){
                    this.unexpected();
                }
                this.next();
                var modifier = this.finishNode(this.startNode(),"ModifierDeclaration");
                modifier.name = "internal";
                var node = this.parseStatement(null, topLevel, exports);
                node.modifier = modifier;
                return node;
            case tokTypes._final : 
                if( !topLevel ){
                    this.unexpected();
                }
                this.next();
                var modifier = this.finishNode(this.startNode(),"ModifierDeclaration");
                modifier.name = "final";
                var node = this.parseStatement(null, topLevel, exports);
                node.final = modifier;
                return node;
            case tokTypes._protected : 
                if( !topLevel ){
                    this.unexpected();
                }
                this.next();
                var modifier = this.finishNode(this.startNode(),"ModifierDeclaration");
                modifier.name = "protected";
                var node = this.parseStatement(null, topLevel, exports);
                node.modifier = modifier;
                return node;
            case tokTypes._private : 
                this.raise( this.lastTokStart, `Private modifier can only be used in class member methods`);
            break;
            case tokTypes._static:
                if( !topLevel ){
                    this.unexpected();
                }
                this.next();
                var modifier = this.finishNode(this.startNode(),"ModifierDeclaration");
                modifier.name = "static";
                var node = tokTypes._class === this.type ? this.parseClass(this.startNode(), true) : this.parseStatement(null, topLevel, exports);
                node.static = modifier;
                return node;  
            case tokTypes._import:
                if( !topLevel ){
                    //this.unexpected();
                    return super.parseStatement(context, topLevel, exports);
                }
                return this.parseImport( this.startNode() );
            case tokTypes._when:
                return this.parseWhenStatement( this.startNode() );
            case tokTypes._enum:
                return this.parseEnumStatement( this.startNode(), topLevel );
            case tokTypes._interface:
                if(this.parseDeclareModuleContext){
                    return this.parseDeclarator(this.startNode(), false);
                }
                if( !topLevel) { this.unexpected(); }
                return this.parseInterface( this.startNode(), topLevel );
            case tokTypes._annotation:
                if( topLevel ) {
                    return this.parseAnnotation();
                }
            break;
            case tokTypes._struct:
                if( topLevel ) {
                    this.next();
                    if(!isDeclaredModule && this.type === tokTypes.name && this.value ==='table' ){
                        return this.parseStructTableDeclarator();
                    }else{
                        this.unexpected();
                    }
                }else{
                    this.unexpected();
                } 
            break;
            case tokTypes._function :
            case tokTypes._class :
            case tokTypes._const :
            case tokTypes._var : 
                if(this.parseDeclaratorContext || this.parseDeclareModuleContext){
                    return this.parseDeclarator( this.startNode() );
                }
                break;
            default:
        }

        if(this.parseDeclareModuleContext && this.type === tokTypes.name && this.value ==="namespace"){
            return this.parseDeclareModuleNamespace();
        }
        
        if( topLevel && this.value ==="declare" ){
            this.next();
            return this.parseDeclarator( this.startNode() );
        }
        else if( this.type === tokTypes.name && this.value ==="await" && !this.inAsync){
            return this.parseAwait();
        }
        else if( this.type === tokTypes.name && this.value ==="type" && !this.isAsyncFunction() ){
            if(this.parseDeclaratorContext || this.parseDeclareModuleContext){
                return this.parseDeclarator( this.startNode() );
            }
            var node = this.startNode();
            var maybeName = this.value, expr = this.parseExpression();
            if( expr.type === "Identifier"){ 
                if( this.eat(tokTypes.colon) ){
                    return this.parseLabeledStatement(node, maybeName, expr, context)
                }else if( this.type === tokTypes.name ){
                    return this.parseTypeStatement(node);
                }
            }
            return this.parseExpressionStatement(node, expr);
        }
        return super.parseStatement(context, topLevel, exports);
    }

    parseTypeStatement(node){
        node.id = this.parseIdent( false );
        node.genericity = this.parseGenericType();
        this.expect( tokTypes.eq );
        node.kind = 'statement';
        if(node.genericity){
            node.left = node.id
            node.right = this.parseTypeDefinition();
            this.finishNode(node, "DeclaratorTypeAlias");
        }else{
            node.init = this.parseTypeDefinition();
            this.finishNode(node, "TypeStatement");
        }
        this.semicolon();
        return node;
    }

    parseStructTableDeclarator(){
        this.disabledJSXExpressionFlag = true;
        this.next();
        const node = this.startNode();
        node.id = this.parseIdent(false);
        node.extends = [];
        node.body=[];
        if( this.eat(tokTypes._extends) ){
            do{
                node.extends.push( this.parseIdent(false) );
            }while( this.eat(tokTypes.comma) );
        }
        this.expect(tokTypes.braceL);
        const parseNode=( isIdent )=>{
            let node = null;
            if( this.type === tokTypes.backQuote ){
                node = this.startNode();
                const start = this.start;
                this.next();
                node.name = this.value;
                this.next();
                this.expect(tokTypes.backQuote);
                node.raw = this.input.slice(start, this.lastTokEnd);
                this.finishNode(node,'Identifier');
            }else if( isIdent ){
                node = this.parseIdent(true);
            }
            if( node ){
                return this.parseChainIdentifier( node )
            }
            return this.type === tokTypes.name ? this.parseIdent(true) : this.parseLiteral(this.value);
        };
        const parseToken=()=>{
            const start=this.start, startLoc=this.startLoc;
            let value = parseNode();
            if( value.type ==="Identifier" || value.type ==='MemberExpression' ){
                if( this.eat(tokTypes.parenL) ){
                    const token = this.startNodeAt(start,startLoc);
                    token.key = value;
                    token.params = [];
                    while( tokTypes.parenR !== this.type ){
                        token.params.push( parseNode() );
                        this.eat(tokTypes.comma);
                    }
                    this.expect(tokTypes.parenR);
                    return this.finishNode(token,'StructTableMethodDefinition');
                }else {
                    const key = value.name.toLowerCase();
                    if( key === 'default' || key === 'character' ||  key === 'collate' || key === 'comment' || key ==='using'){
                        const token = this.startNodeAt(start,startLoc);
                        token.assignment = false;
                        token.key = value;
                        token.init = parseNode();
                        return this.finishNode(token,'StructTablePropertyDefinition');
                    }else if( key ==='unsigned' ){
                        this.raise(start, 'The `unsigned` keywords must follow `column-type`');
                    }
                }
            }
            return value;
        };

        const parseProperties=()=>{
            const items = [];
            while( true ){
                if( this.eat(tokTypes.comma) || this.eat(tokTypes.semi) || this.canInsertSemicolon() ){
                    break;
                }
                items.push( parseToken() );
            }
            return items;
        };

        const check=(token, start, id, message)=>{
            if( !(token && token.type ==='StructTableMethodDefinition' && (id==='*' || token.key.name.toLowerCase() === id) ) ){
                this.raise(start, message)
                return false;
            }
            return true;
        }

        while( tokTypes.braceR !== this.type ){
            const column = this.startNode();
            const key = parseNode(true);
            const question = this.eat(tokTypes.question);
            const start = this.start;
            if( this.eat(tokTypes.colon) ){
                column.key = key;
                column.question = question;
                column.typename = parseToken();
                if( check(column.typename, start, '*', 'Expect token is `column-type(...)`' ) ){
                    if( this.type === tokTypes.name && this.value.toLowerCase()==='unsigned'){
                        column.typename.unsigned = true;
                        this.next();
                    }
                }
                column.properties = parseProperties();
                node.body.push( column );
                this.finishNode(column,'StructTableColumnDefinition');
            }else if(!question){
                const name = key.name.toLowerCase();
                column.key = key;
                if( name==='primary' || name==='unique' || name==='fulltext' || name==='key' ){
                    if( !(name === 'key' || name==='primary') ){
                        if( !(this.type === tokTypes.name && this.value.toLowerCase() ==='key') ){
                            this.raise(this.start, 'Expect token is `key` keywords.')
                        }else{
                            this.next();
                        }
                    }
                    column.local = parseToken();
                    if( name==='primary' ){
                        check(column.local, start, 'key', 'Expect token is `primary key(column-name...)`');
                    }else{
                        check(column.local, start, '*', 'Expect token is `key name(column-name...)`');
                    }
                    column.properties = parseProperties();
                    this.finishNode(column,'StructTableKeyDefinition');
                    node.body.push( column );
                }else{
                    column.properties = parseProperties();
                    this.finishNode(column,'StructTableKeyDefinition');
                    node.body.push( column );
                }
            }else{
                this.unexpected( start );
            }
        }
        this.expect(tokTypes.braceR);
        while( this.type === tokTypes.name || this.type === tokTypes.backQuote){
            const property = this.startNode();
            property.key = parseNode( true );
            property.init = null;
            if( this.eat(tokTypes.eq) ){
                property.assignment = true;
                property.init = parseNode();
            }
            node.body.push(property);
            this.finishNode(property,'StructTablePropertyDefinition');
        }
        this.semicolon();
        return this.finishNode(node,'StructTableDeclaration');
    }

    shouldParseExportStatement(){
        if( this.parseDeclareModuleContext ){
            if(this.type === tokTypes.name && (this.value ==="declare" || this.value ==="type" || this.value ==="namespace") || this.type.keyword==='interface'){
                return true;
            }
        }
        return super.shouldParseExportStatement()
    }

    parseUseStatement(){
        this.disabledJSXExpressionFlag = true;
        const node = this.startNode();
        node.keywords = [ this.parseIdent(true) ];
        node.extends = [];
        if( this.eat(tokTypes.comma) ){
            node.keywords.push( this.parseIdent(true) );
        }
        if( this.eat( tokTypes._extends ) ){
            do{
                const object = this.startNode();
                object.id = this.parseChainIdentifier();
                object.genericity = this.getGenerics(true);
                object.modifier = [];
                while( this.eat(tokTypes.colon) ){
                    const token = this.parseIdent(true);
                    object.modifier.push( token );
                }
                node.extends.push( this.finishNode(object,'UseExtendSpecifier') );
            }while( this.eat(tokTypes.comma) );
        }

        const body = [];
        if( this.eat(tokTypes.braceL) ){
            while( this.type !== tokTypes.braceR ){
                this.parseInterfaceElementFlag = true; 
                const element = this.parseClassElement(false,true,true);
                this.parseInterfaceElementFlag = false; 
                if(element){
                    body.push( element )
                }
            }
            this.expect( tokTypes.braceR );
        }
        node.body = body;
        this.semicolon();
        return this.finishNode(node,'UseExtendStatement');
    }

    parseWhenStatement(node){
        const currentScope = this.currentScope();
        const inherit = (scope, inherit)=>{
            scope.var = scope.var.concat( inherit.var );
            scope.lexical = scope.lexical.concat( inherit.lexical );
            scope.functions = scope.functions.concat( inherit.functions );
        };

        this.next();
        node.test = this.parseParenExpression();
        this.enterScope( SCOPE_FUNCTION | SCOPE_SUPER );
        const whenScope = this.currentScope()
        inherit( whenScope, currentScope);
        node.consequent = super.parseStatement("when");
        this.exitScope();

        this.enterScope( SCOPE_FUNCTION | SCOPE_SUPER );
        const thenScope = this.currentScope()
        inherit(thenScope, currentScope);
        node.alternate = this.eat(tokTypes._then) ? super.parseStatement("then") : null;
        this.exitScope();

        inherit(currentScope, whenScope);
        inherit(currentScope, thenScope);
        return this.finishNode(node, "WhenStatement");
    }

    parseEnumProperty(){
        const node = this.startNode();
        node.key = this.startNode();
        if (this.type === tokTypes.name) {
            node.key.name = this.value;
            this.next();
            this.checkUnreserved(node.key);
            this.finishNode( node.key, "Identifier");
        } else {
            this.unexpected();
        }
        if( this.eat(tokTypes.eq) ){
            node.init = this.type === tokTypes.num ? this.parseLiteral(this.value) : this.parseExprAtom();
        }
        return this.finishNode(node, "EnumProperty");
    };

    parseEnumStatement(node){
        this.disabledJSXExpressionFlag = true;
        this.next();
        node.key = this.parseIdent(false,false)
        this.expect( tokTypes.braceL );
        this.enterScope(1);
        const properties = [];
        while( this.type !== tokTypes.braceR ){
           if( this.type !== tokTypes.name ){
               this.unexpected();
           }
           properties.push( this.parseEnumProperty() );
           if( this.type === tokTypes.comma ){
               this.next();
           }
        }
        node.properties = properties;
        this.expect( tokTypes.braceR );
        this.semicolon();
        this.exitScope();
        return this.finishNode(node, "EnumDeclaration")
    }

    parseClass(node, isStatement){
        this.disabledJSXExpressionFlag = true;
        return super.parseClass(node, isStatement)
    }

    parseInterface(node) {
        this.disabledJSXExpressionFlag = true;
        this.parseInterfaceContext = true;
        this.next();
        var oldStrict = this.strict;
        this.strict = true;
        this.parseClassId(node, true);
        if( this.type === tokTypes._extends  ){
            this.next();
            node.extends = this.parseChainIdentifier();
            if( node.extends ){
                node.extends.genericity = this.getGenerics(true);
            }
        }
        if( this.eat(tokTypes._implements) ){
            node.implements = [];
            do{ 
                const imp = this.parseChainIdentifier();
                if( imp ){
                    imp.genericity = this.getGenerics(true);
                }
                node.implements.push( imp );
            }while( this.eat(tokTypes.comma) );
        }

        var body = [];
        this.expect(tokTypes.braceL);
        this.enterScope(1);
        while (this.type !== tokTypes.braceR) {
            this.parseInterfaceElementFlag = true; 
            var element = this.parseClassElement(false);
            if (element) {
                body.push(element);
            }
        }
        node.body = body;
        this.strict = oldStrict;
        this.expect(tokTypes.braceR);
        this.exitScope();
        this.parseInterfaceContext = false;
        return this.finishNode(node,  "InterfaceDeclaration")
    }

    parseDeclarator(node, isDeclare=true){
        this.disabledJSXExpressionFlag = true;
        this.parseDeclaratorContext = true;
        var oldStrict = this.strict;
        this.strict = true;
        node.kind = "class";
        var [modifier,staticNode,finalNode] = this.parseModifier()
        node.modifier = modifier;
        node.static = staticNode;
        node.final = finalNode;
        if( this.type === tokTypes._const || this.type === tokTypes._var || this.isLet()){
            const kind = this.value;
            node.expression = this.parseVarStatementDefinition(node, "var", false, true);
            node.expression.kind = kind;
            node.kind = kind;
            node.id = node.expression.declarations[0].id;
            return this.finishNode(node,"DeclaratorVariable");
        }else if( this.type  === tokTypes._function){
            this.next();
            node.kind = "function";
            node.id = this.parseIdent();
            const generics = this.parseGenericType();
            this.expect(tokTypes.parenL);
            node.genericity = generics;
            node.params = this.parseBindingList(tokTypes.parenR, false, true);
            if( this.eat( tokTypes.colon ) ){
                node.returnType = this.parseTypeDefinition();
            }
            this.semicolon();
            this.finishNode(node, "DeclaratorFunction");
            return node;
        }else if(this.type === tokTypes._class){
            this.next();
            node.kind = "class";
        }else if( this.type === tokTypes._interface ){
            this.next();
            node.kind = "interface";
        }else if(this.value ==='module'){
            node.kind = "module";
            this.parseDeclareModule(node);
            return node;
        }else if(this.value ==='namespace'){
            return this.parseDeclareModuleNamespace();
        }
        
        this.parseClassId(node, false);
        if( this.type === tokTypes._extends  ){
            this.next();
            node.extends = this.parseChainIdentifier();
            if( node.extends ){
                node.extends.genericity = this.getGenerics(true);
            }
        }

        if( this.eat(tokTypes._implements) ){
            node.implements = [];
            do{ 
                const imp =  this.parseChainIdentifier();
                if( imp ){
                    imp.genericity = this.getGenerics(true);
                }
                node.implements.push( imp );
            }while( this.eat(tokTypes.comma) );
        }

        if( this.type !== tokTypes.braceL && node.id && node.id.name ==="type" ){
            if(!isDeclare){
                return this.parseTypeStatement(node)
            }
            node.left = this.parseIdent(true);
            node.id = node.left;
            node.genericity = this.parseGenericType();
            node.kind = "declare";
            if (this.eat(tokTypes.eq)) {
                node.right = this.parseTypeDefinition(false);
            } else {
                this.unexpected();
            }
            this.semicolon();
            return this.finishNode(node,"DeclaratorTypeAlias");
        }

        var body = [];
        this.expect( tokTypes.braceL );
        this.enterScope(1);
        while (this.type !== tokTypes.braceR){
            this.parseInterfaceElementFlag = true; 
            var element = this.parseClassElement( node.kind === "class" , true);
            if (element){
                body.push(element);
            }
        }
        this.expect(tokTypes.braceR)
        this.strict = oldStrict;
        node.body = body;
        this.exitScope();
        this.finishNode(node,  "DeclaratorDeclaration");
        this.parseDeclaratorContext = false;
        return node;
    }

    eatContextual(k){
        if(k ==='as' && this.eat( tokTypes._as ) )return true;
        const result = super.eatContextual(k);
        if( result && (k ==='get' || k ==='set') && this.tryPropertyContextualFlag ){
            this.tryPropertyContextualGenerics = this.parseGenericType();
            this.tryPropertyContextualFlag = false;
        }
        return result;
    }

    parseChainIdentifier( base=null, isImporter=false ){
        const startPos = this.start, startLoc = this.startLoc;
        base = base || super.parseIdent(true);
        while ( this.eat( tokTypes.dot ) ) {
            if( isImporter && this.canInsertSemicolon() ){
                if( this.keywords.test(this.value) && this.input.charCodeAt(this.start+this.value.length)===32 ){
                    this.unexpected(this.lastTokEnd);
                }
            }
            const node = this.startNodeAt(startPos, startLoc);
            node.object = base;
            node.property = this.parseIdent(true);
            base = this.finishNode(node,"MemberExpression");
        }
        return base;
    }

    parseGenericType(){
        if( this.type === tokTypes.relational && this.value && this.value.charCodeAt(0) === 60 ){
            const generics = this.startNode(); 
            const elements = [];

            const endToken = this.__$endToken || (this.__$endToken = []);
            endToken.push({token:tokTypes.bitShift,value:tokTypes.relational, endCode:62});

            this.next();
            do{
                if(this.type===tokTypes.relational && this.value.charCodeAt(0) === 62){
                    break;
                }
                let start = this.start, startLoc = this.startLoc;
                let left  = this.parseTypeDefinition();
                let type  = left; 
                if( this.eat(tokTypes.eq) ){
                    type = this.startNodeAt(start,startLoc);
                    type.left = left;
                    type.right = this.parseTypeDefinition();
                    this.finishNode(type,"GenericTypeAssignmentDeclaration");
                }else{
                    if( this.eat(tokTypes._extends) ){
                        let _extends = this.parseTypeDefinition();
                        if(this.eat(tokTypes.eq)){
                            type = this.startNodeAt(start,startLoc);
                            type.left = left;
                            type.extends = _extends;
                            type.right = this.parseTypeDefinition();
                            this.finishNode(type,"GenericTypeAssignmentDeclaration");
                        }else{
                            left.extends = _extends;
                            this.finishNode(type,"GenericTypeDeclaration");
                        }
                    }else{
                        this.finishNode(type,"GenericTypeDeclaration");
                    }
                }
                elements.push( type );
            }while( this.eat(tokTypes.comma) );
            if( !(this.type===tokTypes.relational && this.value.charCodeAt(0) === 62) ){
                this.unexpected();
            }else{
                this.next();
            }
            endToken.pop();
            
            generics.elements = elements;
            return this.finishNode(generics, "GenericDeclaration");
        }
        return null;
    }

    testTupleUnion(){
        const content = this.input;
        let index = this.start;
        let balancer  = 1;
        let comment = false;
        while( index < content.length ){
            const code = content.charCodeAt( index );
            if( comment === false && code === 47 && content.charCodeAt( index+1 ) === 42){
                comment = 47;
                index++;
            }else if( code === 42 && content.charCodeAt( index+1 ) === comment ){
                comment = false;
                index++;
            }else if( comment === false && code === 47 && content.charCodeAt( index+1 ) === 47 ){
                comment = 10;
                index++;
            }else if( comment === code ){
                comment = false;
            }else if( comment === false ){
                if( code===40 ){
                    balancer++;
                }else if( code===41 ){
                    balancer--;
                }
                if( code===59 || balancer===0 ){
                    break;
                }
            }
            index++;
        }
        if( balancer===0 ){
            while(index<content.length && content.charCodeAt(index+1)===32 && index++);
            return {
                arrow:content.charCodeAt( index+1 )===61 && content.charCodeAt( index+2 )===62,
                array:content.charCodeAt( index+1 )===91
            };
        }
        return null;
    }

    testGenericsContext(){
        const content = this.input;
        let index = this.start;
        let balancer  = 0;
        let comment = false;
        while( index < content.length ){
            const code = content.charCodeAt( index );
            if( comment === false && code === 47 && content.charCodeAt( index+1 ) === 42){
                comment = 47;
                index++;
            }else if( code === 42 && content.charCodeAt( index+1 ) === comment ){
                comment = false;
                index++;
            }else if( comment === false && code === 47 && content.charCodeAt( index+1 ) === 47 ){
                comment = 10;
                index++;
            }else if( comment === code ){
                comment = false;
            }else if( comment === false ){
                if( code===60 ){
                    balancer++;
                }else if( code===62 ){
                    balancer--;
                }
                if(balancer > 0 && (code === 123 || code ===91) )return true;
                const allow = (code >= 97 && code <= 122) || (code >= 65 && code <= 93) || (code >= 48 && code <= 57 && index > this.start) ||
                                code===44 || code===13 || code===10 || code===36 || code===32 || 
                                code===95 || code===60 || code===62 || code===46;
                if( !allow || balancer===0 ){
                    break;
                }
            }
            index++;
        }
        return balancer===0;
    }

    getGenerics( flag , node){
        if( this.type === tokTypes.relational && this.value && this.value.charCodeAt(0) === 60 ){
            if( !flag ){
                flag = this.testGenericsContext();
            }
            if( flag ){
                this.next();
                const generics = [];
                const endToken = this.__$endToken || (this.__$endToken = []);
                endToken.push({token:tokTypes.bitShift,value:tokTypes.relational, endCode:62});
                while( !(this.type === tokTypes.relational && this.value.charCodeAt(0) === 62 && this.value.length===1) ){
                    const type = this.parseTypeDefinition();
                    if( type.restElement ){
                        this.raise( type.start, "Rest type can only appear in tuple types");
                    }
                    generics.push( type );
                    if( !this.eat(tokTypes.comma) ){
                        break;
                    }
                }
                endToken.pop();
                if( this.type === tokTypes.relational && this.value.charCodeAt(0) === 62 && this.value.length===1 ){
                    this.next();
                }else{
                    this.raise( this.start, `Expected '>'` );
                }
                if( node ){
                    node.typeElements = generics;
                    this.finishNode(node, "TypeGenericDefinition");
                }
                return generics;
            }
        }
        return null;
    }

    readToken_lt_gt(code){
        if( code === 62 ){
            const endToken = this.__$endToken;
            if( endToken && endToken.length > 0 ){
                return super.finishOp(tokTypes.relational, 1);
            }
        }
        return super.readToken_lt_gt(code);
    }

    parseTypeDefinition(prefix){
        this.__parseTypeStatement = true;
        this.eat(tokTypes.bitwiseOR);
        this.eat(tokTypes.bitwiseAND);
        let start = this.start, startLoc= this.startLoc;
        let node = this.parseTypeDefinitionItem(prefix)
        let unions = [node];
        let _startLoc = this.startLoc;
       
        while( true ){
            if(this.eat(tokTypes.bitwiseOR)){
                unions.push(this.parseTypeDefinitionItem());
            }else if(this.eat(tokTypes.bitwiseAND)){
                const left = unions.pop()
                const intersection = this.startNodeAt(left.start,_startLoc);
                intersection.left = left;
                intersection.right = this.parseTypeDefinitionItem();
                unions.push( intersection );
                this.finishNode(intersection,"TypeIntersectionDefinition");
                _startLoc = this.startLoc;
            }else{
                break;
            }
        }
        this.__parseTypeStatement = false;
        if(unions.length > 1){
            const unionNode = this.startNodeAt(start,startLoc);
            unionNode.elements = unions;
            return this.finishNode(unionNode,"TypeUnionDefinition");
        }
        return unions[0];
    }

    parseTypeDefinitionItem(prefix){

        let node = prefix ? this.startNodeAt(prefix.start,prefix.loc ? prefix.loc.start : 0) : this.startNode();
        if( tokTypes._typeof === this.type){
            this.next();
            node.value = this.parseExpression();
            return this.finishNode(node, 'TypeTypeofDefinition');
        }

        let typeName = "TypeDefinition";
        let declGenerics = this.parseGenericType();
        
        if( this.type  === tokTypes._void ){
            node.value = this.parseChainIdentifier();
            this.finishNode(node, typeName);
        }else if( this.type === tokTypes.name || this.type === tokTypes._class || this.type === tokTypes._this ){
            if( this.value ==="keyof"){
                this.next();
                node.value = this.parseTypeDefinition();
                this.finishNode(node, 'TypeKeyofDefinition');
            }else{
                node.value = this.parseChainIdentifier();
                if(node.value.type ==='Identifier' && this.type === tokTypes._is && !this.canInsertSemicolon()){
                    this.next();
                    node.argument = node.value;
                    node.value =  this.parseTypeDefinition();
                    this.finishNode(node, 'TypePredicateDefinition');
                    return node;
                }

                if(!this.canInsertSemicolon()){
                    const generics = this.getGenerics(true);
                    if( generics ){
                        node.typeElements = generics;
                        typeName = "TypeGenericDefinition";
                    }
                }

                if(node.value.type ==='Identifier' && typeName==='TypeDefinition' && node.value.name ==='unique' && this.type === tokTypes.name){
                    node.value =  this.parseTypeDefinition();
                    this.finishNode(node, 'TypeUniqueDefinition');
                    return node;
                }

                this.finishNode(node, typeName);
                if( this.type === tokTypes.bracketL && !this.canInsertSemicolon()){
                    node = this.parseTypeDefinition(node);
                }
            }

        }else if( this.eat(tokTypes.bracketL) ){

            const elements = [];
            while( !(this.type === tokTypes.bracketR) ){
                const start = this.start, startLoc= this.startLoc;
                const restElement = !!this.eat(tokTypes.ellipsis);
                let nodeType = this.parseTypeDefinition();
                if( restElement ){
                    const restNode = this.startNodeAt(start, startLoc);
                    restNode.value = nodeType;
                    this.finishNode(restNode,"TypeTupleRestDefinition");
                    nodeType = restNode;
                }
                elements.push( nodeType );
                if( !this.eat(tokTypes.comma) ){
                    break;
                }
            } 
            this.expect( tokTypes.bracketR );
            
            if( prefix && elements.length === 1){
                node.object = prefix;
                node.property = elements[0];
                typeName = "TypeComputeDefinition";
            }else{
                node.prefix = prefix;
                node.elements = elements;
                typeName = "TypeTupleDefinition";
            }

            this.finishNode(node, typeName);
            if( this.type === tokTypes.bracketL && !this.canInsertSemicolon() ){
                node = this.parseTypeDefinition( node );
            }
        }
        else if( this.eat(tokTypes.braceL) ){

            let first = true;
            node.properties = [];
            const propHash = Object.create(null);
            const parseProperty = ()=>{
                const prop = this.startNode();
                let start = this.start, startLoc= this.startLoc;
                let declGenerics = this.parseGenericType();
                let method = null;
                let readonly = null
                if(this.eat(tokTypes.parenL)){
                    prop.key = this.startNodeAt(start, startLoc);
                    prop.key.name = '#call#';
                    this.finishNode(prop.key, "Identifier")
                    method = this.startNodeAt(start, startLoc);
                    method.genericity = declGenerics;
                    method.params = this.parseBindingList(tokTypes.parenR, false, true);
                }else{
                    if( this.type === tokTypes.name && this.value==='readonly'){
                        readonly = this.parseIdent(false);
                    }
                    if( this.eat(tokTypes.bracketL) ) {
                        prop.key = this.parseIdent( false );
                        prop.key.computed = true;
                        if(this.eat(tokTypes.colon)){
                            prop.key.acceptType = this.parseTypeDefinition();
                        }else if(tokTypes.dot === this.type){
                            prop.key = this.parseSubscripts(prop.key, prop.key.start, prop.key.loc)
                        }
                        this.expect( tokTypes.bracketR )
                    }else{
                        if(readonly && tokTypes.colon === this.type){
                            prop.key=readonly;
                            readonly = null;
                        }else{
                            if(this.type === tokTypes.string || this.type === tokTypes.num){
                                prop.key=this.parseLiteral(this.value);
                            }else{
                                prop.key=this.parseIdent(true);
                                if(prop.key.name==='new'){
                                    prop.key.name = '#new#'
                                }
                            }
                        }
                    }
                    declGenerics = this.parseGenericType();
                    if(this.eat(tokTypes.parenL)){
                        method = this.startNodeAt(start, startLoc);
                        method.genericity = declGenerics;
                        method.params = this.parseBindingList(tokTypes.parenR, false, true);
                    }else if(declGenerics){
                        this.unexpected();
                    }
                    if( this.eat(tokTypes.question) ) {
                        prop.key.question = true;
                    } 
                }

                if( this.eat(tokTypes.colon) ) {
                    if(method){
                        method.value = this.parseTypeDefinition();
                        prop.value = method;
                        this.finishNode(method, "TypeFunctionDefinition")
                    }else{
                        prop.value = this.parseTypeDefinition();
                    }
                }else if(method){
                    prop.value = method;
                    this.finishNode(method, "TypeFunctionDefinition")
                }
                if(!(prop.key.computed || prop.key.name==='#new#' || prop.key.name==='#call#')){
                    let key = prop.key.name || prop.key.value;
                    if(propHash[key] === true){
                        this.raiseRecoverable(prop.key.start, "Redefinition of property")
                    }
                    propHash[key] = true;
                }
                prop.readonly = !!readonly;
                return this.finishNode(prop, "TypeObjectPropertyDefinition")
            }

            while (!this.eat(tokTypes.braceR)) {
                if (!first) {
                    if(this.type === tokTypes.semi){
                        this.next();
                    }else{
                        this.expect(tokTypes.comma);
                    }
                    if (this.options.ecmaVersion >= 5 && this.afterTrailingComma(tokTypes.braceR)) { break }
                } else { first = false; }
                node.properties.push( parseProperty() );
            }

            this.finishNode(node, "TypeObjectDefinition");
            if( this.type === tokTypes.bracketL && !this.canInsertSemicolon() ){
                node = this.parseTypeDefinition( node );
            }

        }else if( this.eat(tokTypes.parenL) ){
            if( this.type === tokTypes.parenL ){
                node = this.parseTypeDefinition();
                this.expect( tokTypes.parenR );
            }else{
                const result = this.testTupleUnion();
                if( result && !result.arrow && result.array){
                    const tynode = this.parseTypeDefinition();
                    this.expect( tokTypes.parenR );
                    this.expect( tokTypes.bracketL );
                    this.expect( tokTypes.bracketR );
                    if( tynode.type ==="TypeUnionDefinition" || tynode.type ==="TypeIntersectionDefinition" ){
                        typeName = "TypeTupleUnionDefinition";
                        node = tynode;
                    }else{
                        typeName = "TypeTupleDefinition";
                        node.prefix = tynode;
                        node.elements = [];
                    }
                    this.finishNode(node, typeName);
                }else if(result && result.arrow){
                    const params = this.parseBindingList(tokTypes.parenR, false, this.options.ecmaVersion >= 8);
                    this.expect( tokTypes.arrow );
                    node.params = params;
                    node.value = this.parseTypeDefinition();
                    node.genericity = declGenerics;
                    typeName = "TypeFunctionDefinition";
                    this.finishNode(node, typeName);
                }else{
                    node = this.parseTypeDefinition();
                    this.expect( tokTypes.parenR );
                }
            }
        }
        else if( tokTypes.num === this.type || tokTypes.string === this.type || tokTypes._null === this.type || tokTypes._true === this.type ||  tokTypes._false === this.type ){
            node.value = this.parseExprAtom();
            this.finishNode(node, typeName);
        }
        else if(tokTypes.plusMin === this.type){
            const value = this.value;
            this.next();
            if( tokTypes.num === this.type ){
                node.value = this.parseExprAtom();
                if( String(value).charCodeAt(0) === 45 ){
                    node.value.value = -node.value.value;
                    node.value.raw = String(node.value.value);
                }
                this.finishNode(node, typeName);
            }else{
                this.unexpected();
            }
        }
        else{
            this.unexpected();
        }
        if(declGenerics && node.type !== 'TypeFunctionDefinition'){
            this.unexpected();
        }
        return node;
    }

    parseAnnotation( nonStatement ){
        const node = this.startNode();
        this.next();
        node.name = this.value;
        var n = node.name;
        this.next();
        if( this.eat( tokTypes.parenL ) ){
            node.body = [];
            const getParamNode = ()=>{
                var startPos = this.start, startLoc = this.startLoc;
                switch( this.type ){
                    case tokTypes.string :
                    case tokTypes.num    :
                    case tokTypes._null  :
                    case tokTypes._true  :
                    case tokTypes._false :
                        return super.parseExprAtom();
                    default :  
                        const node = this.parseMaybeDefault(startPos,startLoc);
                        if( node.type ==="Identifier" ){
                            return this.parseSubscripts(node, startPos, startLoc, true);
                        }else if( node.type === "AssignmentPattern" || node.type ==="ArrayPattern" || node.type ==="ObjectPattern" ){
                            return node;
                        }else{
                            this.raise(this.pos,`Annotation expression parameters can only is scalar type`);
                        }
                }
            }
            while( this.type !== tokTypes.parenR ){
                const param = getParamNode();
                if( param ){
                    node.body.push( param );
                }
                if( !this.eat(tokTypes.comma) ){
                    break;
                }
            }
            this.expect( tokTypes.parenR );
        }
        if( nonStatement === true ){
            this.finishNode(node, "AnnotationExpression");
            if( this.canInsertSemicolon() ){
                this.semicolon();
            }
            return node;
        }else{
            this.semicolon();
            return this.finishNode(node, "AnnotationDeclaration");
        }
    }

    parseMetatype(){
        const node = this.startNode();
        node.name = this.value;
        this.next();
        if( this.eat( tokTypes.parenL )  ){
            node.body = [];
            while( this.type !== tokTypes.parenR ){
                const elem = this.startNode();
                const left = this.startNode();
                elem.name = this.value;
                left.name = this.value;
                this.next();
                if( this.eat(tokTypes.eq) ){
                    elem.left =  this.finishNode(left,"Identifier")
                    elem.right = this.parseMaybeAssign();
                }
                node.body.push( elem )
                if( elem.right ){
                    this.finishNode(elem, "AssignmentPattern");
                }else{
                    this.finishNode(elem, "Identifier");
                }
                if( !this.eat(tokTypes.comma) ){
                    break;
                }
            }
            this.expect( tokTypes.parenR );
        }
        this.expect( tokTypes.bracketR );
        this.semicolon();
        return this.finishNode(node, "MetatypeDeclaration");
    }

    parseModifier(){
        const modifierItems = Array(3);
        while( tokenModifiers.includes( this.type ) ){
            const name = this.type.label;
            this.step();
            if(this.type === tokTypes.name || this.type.keyword){
                this.apply()
            }else{
                this.apply(-1)
                break;
            }
            const modifier = this.startNode();
            modifier.name = name;
            this.finishNode(modifier, "ModifierDeclaration");
            if( name ==='final' ){
                modifierItems[3] = modifier;
            }else if( name ==='static' ){
                modifierItems[1] = modifier;
            }else{
                modifierItems[0] = modifier;
            }
        }
        return modifierItems;
    }

    parseClassProperty(node,kind,bracketStarted,isDeclareInterface) {
        node = this.parseVarStatementDefinition( node, kind, bracketStarted, isDeclareInterface);
        if( isDeclareInterface && node.type ==='MethodDefinition' && bracketStarted ){
            return node;
        }
        if( node.declarations && node.declarations.length > 1){
            this.raise( node.start, `Only one class property member can be defined in a declaration`);
        }
        if(kind==='readonly')kind='const';
        if(kind ==='get' || kind === 'set')kind = 'var';
        node.kind = kind;
        return this.finishNode(node, "PropertyDefinition");
    }

    parseVarStatementDefinition(node, kind,  bracketStarted, isDeclareInterface){
        let isSetOrGet = kind ==='get' || kind === 'set';
        if(isSetOrGet)kind = 'var';
        if(!(bracketStarted || isSetOrGet)){
            this.next();
        }

        let start = this.start;
        let startLoc = this.startLoc;
        const dynamic = this.eat(tokTypes.bracketL);

        let decl = this.startNodeAt(start, startLoc);
        start = this.start;
        startLoc = this.startLoc;

        let id = this.parseIdent( false );
        //this.checkLVal(id, kind === "var" ? BIND_VAR : BIND_LEXICAL, false);
        decl.dynamic = dynamic;
        if(dynamic){
            if( this.eat(tokTypes.colon)){
                id.acceptType = this.parseTypeDefinition();
            }else if(tokTypes.dot === this.type){
                id = this.parseSubscripts(id, start, startLoc)
            }
            this.expect( tokTypes.bracketR )
        }
        if( this.eat(tokTypes.question) ){
            decl.question = true;
        }

        if(bracketStarted){
            let genericity = this.parseGenericType();
            if(this.type=== tokTypes.parenL){
                decl.key = id;
                this.tryPropertyContextualGenerics = genericity;
                return this.parseClassMethod(decl);
            }else if(genericity){
                this.unexpected()
            }
        }

        if( this.eat(tokTypes.colon) ){
            decl.acceptType = this.parseTypeDefinition();
        }
        if(this.eat(tokTypes.eq)){
            decl.init = this.parseMaybeAssign();
        }
        decl.id = id;
        node.declarations = [this.finishNode(decl, "VariableDeclarator")];
        this.semicolon();
        return this.finishNode(node, "VariableDeclaration");
    }
    
    parseClassElement( constructorAllowsSuper, isDeclareInterface, isUseStatement){

        // if( this.eat( tokTypes.bracketL ) ){
        //     return this.parseMetatype();
        // }

        if( this.type === tokTypes._annotation ){
            return this.parseAnnotation();
        }

        if (this.eat(tokTypes.semi)){
            return null;
        }
        
        var start = this.start, startLoc = this.startLoc;
        var isNew = this.eat(tokTypes._new);
        const declGenerics = this.parseGenericType();
        if(tokTypes.parenL === this.type || isNew){
            const node = this.startNodeAt(start, startLoc);
            node.genericity = declGenerics;
            this.enterScope(functionFlags(true));
            super.parseFunctionParams(node);
            if(this.eat(tokTypes.colon)){
                node.returnType = this.parseTypeDefinition();
            }
            if( tokTypes.braceL === this.type){
                this.raise(this.start, `Definition '${isNew ? 'new' : 'call'}' description can only is abstracts`)
            }
            this.exitScope();
            return this.finishNode(node, isNew ? "NewDefinition" : "CallDefinition");
        }
        
        const modifier = this.parseModifier();
        const isBracket = this.type === tokTypes.bracketL;
        let readonly = this.type === tokTypes.name && this.value ==='readonly';
        let isProperty = isBracket || this.type === tokTypes._const || this.type === tokTypes._var || readonly;
        let kind = isBracket ? 'var' : this.value;
        this.tryPropertyContextualFlag = true;
        this.isDeclareInterfaceFlag = isDeclareInterface;

        if(readonly){
            this.step();
            if(this.type === tokTypes.parenL || this.type === tokTypes.relational || this.type === tokTypes.colon){
                readonly = false;
                isProperty = false;
            }
            this.apply(-1);
        }

        this.isUseStatement = isUseStatement;

        if( !isUseStatement && !isProperty && this.value ==="use" && !modifier.some( item=>!!item ) ){
            const type = this.step();
            if( type === tokTypes._static || type === tokTypes._this ){
                this.apply();
                return this.parseUseStatement();
            }else{
               this.apply(-1);
            }
        }

        if(!isProperty && this.type === tokTypes.name && this.value ==='get' || this.value ==='set'){
            this.step();
            if(this.type !== tokTypes.name && this.type !== tokTypes.parenL && this.type !== tokTypes.relational){
                if(this.type === tokTypes.question){
                    this.step();
                    if(this.type === tokTypes.colon){
                        isProperty = true;
                    }
                    this.apply(-2);
                }else{
                    if(this.type === tokTypes.colon){
                        isProperty = true;
                    }
                    this.apply(-1);
                }
            }else{
                this.apply(-1);
            }
        }

        const element = isProperty ? 
                    this.parseClassProperty( this.startNode(), kind, isBracket , isDeclareInterface || isUseStatement ) : 
                    super.parseClassElement( constructorAllowsSuper );

        if( element && element.kind ==="method" && element.isPropertyDefinition ){
            var decl = this.startNodeAt(start, startLoc);
            var key = element.key;
            decl.id = key;
            decl.question = !!key.question
            decl.acceptType = key.acceptType;
            decl.init = key.init;
            element.declarations = [decl];
            element.kind = 'var';
            this.finishNode(decl, "VariableDeclarator");
            this.finishNode(element, "PropertyDefinition");
            delete key.init;
            delete key.acceptType;
            delete key.question;
            delete element.key;
            delete element.isPropertyDefinition;
        }

        const generics = this.tryPropertyContextualGenerics;
        if( generics && element.type ==="MethodDefinition" ){
            element.value.genericity = generics;
        }
        this.tryPropertyContextualGenerics = null;
        if ( modifier[0] ){
            element.modifier =  modifier[0];
        }
        if( modifier[1] ){
            element.static =  modifier[1];
        }
        if( modifier[2] ){
            element.final =  modifier[2];
        }
        return element;
    }

    parsePropertyName(prop){
        if( !prop.key && (prop.kind==='get'||prop.kind==='set') ){
            if(this.type === tokTypes.question || this.type === tokTypes.parenL){
                const node = this.startNodeAt(this.lastTokStart, this.lastTokStartLoc);
                node.question = this.type === tokTypes.question;
                node.name = prop.kind;
                prop.kind = 'method';
                prop.key = node;
                this.finishNode(node, "Identifier");
                this.next();
                return node;
            }
        }
        const node = super.parsePropertyName(prop);
        if( prop.kind ==='method' ){
            if( this.eat( tokTypes.question ) ){
                node.question = true;
            }
            if( prop.key ){
                if( this.eat( tokTypes.colon ) ){
                    prop.isPropertyDefinition = true;
                    prop.key.acceptType = this.parseTypeDefinition();
                }
                if( this.eat( tokTypes.eq ) ){
                    prop.isPropertyDefinition = true;
                    prop.key.init = super.parseMaybeAssign();
                } 
                if( tokTypes.parenL !== this.type ){
                    if( tokTypes.semi === this.type || this.canInsertSemicolon() ){
                        prop.isPropertyDefinition = true;
                    }
                }
                
                if( prop.isPropertyDefinition ){
                    if( this.isDeclareInterfaceFlag ){
                        this.isDeclareInterfaceFlag = false;
                        this.eat( tokTypes.comma );
                    }
                    this.semicolon();
                }
            }
        }
        return node;
    }

    parseClassMethod(method, isGenerator, isAsync, allowsDirectSuper){
        if( method.isPropertyDefinition ){
            return method;
        }else{
            return super.parseClassMethod(method, isGenerator, isAsync, allowsDirectSuper);
        }
    }

    parseImportSpecifiers() {
        var nodes = [], first = true;
        if (this.type === tokTypes.name) {
            // import defaultObj, { x, y as z } from '...'
            var node = this.startNode();
            node.local = this.parseChainIdentifier(null, true);
            nodes.push(this.finishNode(node, "ImportDefaultSpecifier"));
            if (!this.eat(tokTypes.comma)) { return nodes }
            this.checkLVal(node.local, BIND_LEXICAL);
        }

        if (this.type === tokTypes.star) {
            var node$1 = this.startNode();
            this.next();
            this.expect( tokTypes._as );
            node$1.local = this.parseIdent();
            this.checkLVal(node$1.local, BIND_LEXICAL);
            nodes.push(this.finishNode(node$1, "ImportNamespaceSpecifier"));
            return nodes
        }
        this.expect(tokTypes.braceL);
        while (!this.eat(tokTypes.braceR)) {
            if (!first) {
                this.expect(tokTypes.comma);
                if (this.afterTrailingComma(tokTypes.braceR)) { break }
            } else { first = false; }
        
            var node$2 = this.startNode();
            node$2.imported = this.parseIdent(true);
            if (this.eat(tokTypes._as)) {
                node$2.local = this.parseIdent();
            } else {
                this.checkUnreserved(node$2.imported);
                node$2.local = node$2.imported;
            }
            this.checkLVal(node$2.local, BIND_LEXICAL);
            nodes.push(this.finishNode(node$2, "ImportSpecifier"));
        }
        return nodes
    }

    checkLocalExport(){}

    parseImport(node){
        this.next();
        if (this.type === tokTypes.string) {
            node.specifiers = [];
            node.source = this.parseExprAtom();
        } else {
            this.enterScope(SCOPE_TOP);
            const specifiers = this.parseImportSpecifiers();
            if( this.eatContextual('from') ){
                node.specifiers = specifiers;
                node.source = this.type === tokTypes.string ? this.parseExprAtom() : this.unexpected();
            }else{
                if( specifiers.length ===1 && specifiers[0].type ==='ImportDefaultSpecifier'){
                    node.specifiers = [];
                    node.source = specifiers[0].local;
                    if( this.eat(tokTypes._as) ){
                        if( this.type !== tokTypes.name ){
                            this.unexpected();
                        }
                        node.alias = super.parseIdent();
                    }
                    //const iden = node.alias || node.source.property || node.source;
                    //this.checkLVal(iden, BIND_LEXICAL, false);
                }else{
                    this.unexpected();
                }
            }
            this.exitScope();
        }
        this.semicolon();
        return this.finishNode(node, "ImportDeclaration")
    }

    parsePackage(node, isStatement){
        this.next();
        var oldStrict = this.strict;
        this.strict = true;
        node.body = [];
        node.id = null;
        if( this.type === tokTypes.semi ){
            this.next();
        }else if( tokTypes.braceL !== this.type ){
            node.id = this.parseChainIdentifier();
            if( this.type === tokTypes.semi ){
                this.next();
            }
        }

        const metatype = ()=>{
            // if( this.eat( tokTypes.bracketL ) ){
            //     return this.parseMetatype();
            // }
            if( this.type === tokTypes._annotation ){
                return this.parseAnnotation();
            }
            return null;
        }

        if( this.eat(tokTypes.braceL) ){
            node.isBlock = true;
            while( !this.eat(tokTypes.braceR) ){
                const item = metatype();
                if( item ){
                    node.body.push(item);
                }else{
                    if(this.type === tokTypes._export){
                        node.body.push(this.parseExport(this.startNode()))
                    }else{
                        node.body.push(this.parseStatement(null,true));
                    }
                }
            }
        }else{
            node.isBlock = false;
            while( !(tokTypes.eof === this.type || tokTypes._package === this.type) ){
                const item = metatype();
                if( item ){
                    node.body.push(item);
                }else{
                    if(this.type === tokTypes._export){
                        node.body.push(this.parseExport(this.startNode()))
                    }else{
                        node.body.push(this.parseStatement(null,true));
                    }
                }
            }
        }
        this.strict = oldStrict;
        return this.finishNode(node,  "PackageDeclaration")
    }

    parseDeclareModule(node){
        this.next();
        var oldStrict = this.strict;
        this.strict = true;
        node.body = [];
        node.id = null;
        this.parseDeclareModuleContext = true;
        if( this.type === tokTypes.semi ){
            this.raise(this.start, "Declared module identifier cannot is empty.");
        }else if( tokTypes.braceL !== this.type ){
            node.id = this.parseExprSubscripts();
            if( this.type === tokTypes.semi ){
                this.next();
            }
        }

        if( !node.id ){
            this.raise(this.start, "Declared module missing identifier.");
        }

        const metatype = ()=>{
            if( this.type === tokTypes._annotation ){
                return this.parseAnnotation();
            }
            return null;
        }

        if( this.eat(tokTypes.braceL) ){
            node.isBlock = true;
            while( !this.eat(tokTypes.braceR) ){
                const item = metatype();
                if( item ){
                    node.body.push(item);
                }else{
                    if( this.type === tokTypes._export ){
                        node.body.push(this.parseExport(this.startNode()))
                    }else if( this.type === tokTypes._import ){
                        node.body.push(this.parseImport(this.startNode()))
                    }else{
                        let isDeclare = false;
                        if(this.value ==="declare"){
                            isDeclare = true;
                            this.next();
                        }
                        if(this.value ==="namespace" || this.value==="global"){
                            node.body.push(this.parseDeclareModuleNamespace(this.value==="global"));
                        }else{
                            node.body.push( this.parseDeclarator(this.startNode(), isDeclare) );
                        }
                    }
                }
            }
        }else{
            this.unexpected()
        }
        this.strict = oldStrict;
        this.parseDeclareModuleContext = false;
        return this.finishNode(node,  "ModuleDeclaration")
    }

    parseExport(node, exports) {
        this.next();
        if(this.eat(tokTypes.eq)) {
            this._exportAssignmentDeclaration = true;
            node.expression = this.parseExprSubscripts();
            this._exportAssignmentDeclaration = false;
            this.semicolon();
            return this.finishNode(node, "ExportAssignmentDeclaration")
        }

        // export * from '...'
        if (this.eat(tokTypes.star)) {
          if (this.options.ecmaVersion >= 11) {
            if (this.eatContextual("as")) {
              node.exported = this.parseIdent(true);
              this.checkExport(exports, node.exported.name, this.lastTokStart);
            } else {
              node.exported = null;
            }
          }
          if(this.eatContextual("from")){
            if (this.type !== tokTypes.string) { this.unexpected(); }
            node.source = this.parseExprAtom();
          }
          this.semicolon();
          return this.finishNode(node, "ExportAllDeclaration")
        }
        if (this.eat(tokTypes._default)) { // export default ...
          this.checkExport(exports, "default", this.lastTokStart);
          var isAsync;
          if (this.type === tokTypes._function || (isAsync = this.isAsyncFunction())) {
            var fNode = this.startNode();
            this.next();
            if (isAsync) { this.next(); }
            node.declaration = this.parseFunction(fNode, FUNC_STATEMENT | FUNC_NULLABLE_ID, false, isAsync);
          } else if (this.type === tokTypes._class) {
            var cNode = this.startNode();
            node.declaration = this.parseClass(cNode, "nullableID");
          } else {
            node.declaration = this.parseMaybeAssign();
            this.semicolon();
          }
          return this.finishNode(node, "ExportDefaultDeclaration")
        }
        // export var|const|let|function|class ...
        if (this.shouldParseExportStatement()) {
          node.declaration = this.parseStatement(null, true);
          if (node.declaration.type === "VariableDeclaration")
            { this.checkVariableExport(exports, node.declaration.declarations); }
          else
            { this.checkExport(exports, node.declaration.id.name, node.declaration.id.start); }
          node.specifiers = [];
          node.source = null;
        } else { // export { x, y as z } [from '...']
          node.declaration = null;
          node.specifiers = this.parseExportSpecifiers(exports);
          if (this.eatContextual("from")) {
            if (this.type !== tokTypes.string) { this.unexpected(); }
            node.source = this.parseExprAtom();
          } else {
            for (var i = 0, list = node.specifiers; i < list.length; i += 1) {
              // check for keywords used as local names
              var spec = list[i];
    
              this.checkUnreserved(spec.local);
              // check if export is defined
              this.checkLocalExport(spec.local);
            }
    
            node.source = null;
          }
          this.semicolon();
        }
        return this.finishNode(node, "ExportNamedDeclaration")
    }

    parseDeclareModuleNamespace(isGlobal=false){
        if(!isGlobal)this.next();
        const node = this.startNode();
        node.body = [];
        node.id = this.parseChainIdentifier();
        this.expect(tokTypes.braceL)
        const metatype = ()=>{
            if( this.type === tokTypes._annotation ){
                return this.parseAnnotation();
            }
            return null;
        }
        while(!this.eat(tokTypes.braceR)){
            const item = metatype();
            if( item ){
                node.body.push(item);
            }else{
                if( this.type === tokTypes._export ){
                    node.body.push(this.parseExport(this.startNode()))
                }else if( this.type === tokTypes._import ){
                    node.body.push(this.parseImport(this.startNode()))
                }
                else{
                    let isDeclare = false;
                    if(this.value ==="declare"){
                        isDeclare = true;
                        this.next();
                    }
                    if(this.value ==="namespace"){
                        node.body.push(this.parseDeclareModuleNamespace());
                    }else{
                        node.body.push( this.parseDeclarator(this.startNode(), isDeclare) );
                    }
                }
            }
        }
        this.finishNode(node,  "NamespaceDeclaration");
        return node;
    }

    hasBacklash(pos){
        let num = 0;
        while( this.input.charCodeAt(pos--) === 92 && pos > 0 ){
            num++;
        }
        return num % 2===1;
    }

    jsx_readWhitespaceToken(code){
        const start = this.pos; 
        let isNewLine = false;
        while(code === 32 || (isNewLine = acorn.isNewLine(code)) ){
            ++this.pos;
            if( isNewLine ) {
                isNewLine = false;
                if (code === 13 && this.input.charCodeAt(this.pos) === 10) {
                    ++this.pos;
                }
                if (this.options.locations) {
                    ++this.curLine;
                    this.lineStart = this.pos;
                }
            }
            code = this.input.charCodeAt(this.pos);
        }
        if( this.pos !== start){
            this.finishToken(tt_whitespace, this.input.slice(start, this.pos) );
            return true;
        }
        return false;
    }

    jsx_readTextToken( endTag ){
        let out = '', chunkStart = this.pos;
        this.start = chunkStart;
        for (;;) {
            if (this.pos >= this.input.length){
                this.raise(this.start, 'Unterminated JSX contents');
            }
            let ch = this.input.charCodeAt(this.pos);
            if (acorn.isNewLine(ch) ) {
                out += this.input.slice(chunkStart, this.pos);
                out += this.jsx_readNewLine(true);
                chunkStart = this.pos;
            } else if( endTag ){
                if(ch===60 && this.input.charCodeAt(this.pos+1)===47 ){
                    if( !this.hasBacklash(this.pos-1) ){
                        if( this.input.substr(this.pos+2, endTag.length).toLowerCase() === endTag ){
                            out += this.input.slice(chunkStart, this.pos);
                            return this.finishToken(tt_content_text, out);
                        }
                    }
                }
                ++this.pos;
            }else{
                if(ch===93 && this.input.charCodeAt(this.pos+1)===93 && this.input.charCodeAt(this.pos+2)===62 ){
                    if( !this.hasBacklash(this.pos-1) ){
                        out += this.input.slice(chunkStart, this.pos);
                        return this.finishToken(tt_content_text, out);
                    }
                }
                ++this.pos;
            }
        }
    }

    jsx_parseOpeningElementAt(startPos, startLoc) {
        let node = this.startNodeAt(startPos, startLoc);
        node.attributes = [];
        let nodeName = this.jsx_parseElementName();
        if (nodeName) node.name = nodeName;
        while (this.type !== tt.slash && this.type !== tok.jsxTagEnd)
        node.attributes.push(this.jsx_parseAttribute());
        node.selfClosing = this.eat(tt.slash);
        if(nodeName && typeof nodeName.name === 'string' && !node.selfClosing ){
            const name = nodeName.name.toLowerCase();
            if( name ==='script' || name ==='style' ){
                if( name ==='script' ){
                    this.context.push(tc_script_expr);
                }else{
                    this.context.push(tc_style_expr);
                }
            }
        }
        this.expect(tok.jsxTagEnd);
        return this.finishNode(node, nodeName ? 'JSXOpeningElement' : 'JSXOpeningFragment');
    }

    jsx_parseElementAt(startPos, startLoc) {
        let node = this.startNodeAt(startPos, startLoc);
        let children = [];
        let openingElement = this.jsx_parseOpeningElementAt(startPos, startLoc);
        let closingElement = null;
        let scriptType = null;
        if( openingElement.name ){
            const tagName = getQualifiedJSXName(openingElement.name).toLowerCase();
            if( tagName === 'style' ){
                scriptType = 'Style';
            }else if( tagName === 'script' ){
                scriptType = 'Script';
            }
        }
        if (!openingElement.selfClosing) {
            const curCtx = this.curContext();
            if(curCtx === tc_style_expr && this.type !== tt_cdata_start ){
                const scriptNode = this.startNode();
                scriptNode.body = [];
                while( this.type !== tok.jsxTagStart ){
                    switch( this.type ){
                        case tt_whitespace :
                        case tt_content_text :
                        case tok.jsxText :
                           children.push( this.finishNode( this.parseLiteral(this.value), 'JSXText' ) );
                           break;
                        default :
                            this.unexpected();
                    }
                }
                scriptType = 'Style';
                startPos = this.start; startLoc = this.startLoc;
                this.expect( tok.jsxTagStart );
                this.expect( tt.slash );
                closingElement = this.jsx_parseClosingElementAt(startPos, startLoc);
            }else if(curCtx === tc_script_expr && this.type !== tt_cdata_start ){
                this.enterScope(1);
                //let hasInherit = openingElement.attributes.some( item=>item.name.name === "class" );
                while( this.type !== tok.jsxTagStart ){
                    //if( hasInherit ){
                        if( this.type === tokTypes._import ){
                            children.push( this.parseImport( this.startNode() ) );
                        }else{
                            children.push( this.parseClassElement(true) );
                        }
                    //}else{
                        //scriptNode.body.push( this.parseStatement(null, true) );
                    //}
                }
                this.exitScope();
                scriptType = 'Script';
                startPos = this.start; startLoc = this.startLoc;
                this.expect( tok.jsxTagStart );
                this.expect( tt.slash );
                closingElement = this.jsx_parseClosingElementAt(startPos, startLoc);
            }else{
                contents: for (;;) {
                    switch (this.type) {
                        case tok.jsxTagStart:
                            startPos = this.start; startLoc = this.startLoc;
                            this.next();
                            if (this.eat(tt.slash)) {
                                closingElement = this.jsx_parseClosingElementAt(startPos, startLoc);
                                break contents;
                            }
                            children.push(this.jsx_parseElementAt(startPos, startLoc));
                        break;
                        case tok.jsxText:
                            children.push(this.parseExprAtom());
                        break;
                        case tt.braceL:
                            children.push(this.jsx_parseExpressionContainer());
                        break;
                        case tt_cdata_start :
                            this.next()
                            children.push( this.finishNode( this.parseLiteral(this.value), 'JSXCdata' ) );
                            this.expect( tt_cdata_end );
                        break;
                        case tt_content_text :
                            children.push( this.finishNode( this.parseLiteral(this.value), 'JSXText' ) );
                        break;
                        case tt_whitespace :
                            children.push( this.finishNode( this.parseLiteral(this.value), 'JSXText' ) );
                        break;
                        default:
                            this.unexpected();
                    }
                }
            }

            if (getQualifiedJSXName(closingElement.name) !== getQualifiedJSXName(openingElement.name)) {
                this.raise(
                closingElement.start,
                'Expected corresponding JSX closing tag for <' + getQualifiedJSXName(openingElement.name) + '>');
            }
        }

        let fragmentOrElement = openingElement.name ? 'Element' : 'Fragment';
        node['opening' + fragmentOrElement] = openingElement;
        node['closing' + fragmentOrElement] = closingElement;
        node.children = children;
        if (this.type === tt.relational && this.value === "<") {
          this.raise(this.start, "Adjacent JSX elements must be wrapped in an enclosing tag");
        }
        if( scriptType ){
            return this.finishNode(node, 'JSX' + scriptType);
        }else{
            return this.finishNode(node, 'JSX' + fragmentOrElement);
        }
    }

    
    jsx_readCDATAToken(code,noSkip){
        if( !noSkip && this.jsx_readWhitespaceToken(code) ){
            return true;
        }

        if(this.disabledJSXExpressionFlag || this.__parseTypeStatement || this.parseDeclaratorContext || this.parseInterfaceContext){
            return false;
        }

        //<![CDATA[...]]>
        let pos = this.pos;
        if( code===60 && this.input.charCodeAt(pos+1)===33 && this.input.charCodeAt(pos+2)===91 && this.input.charCodeAt(pos+8)===91 && this.input.substr(pos+3,5) === "CDATA" ){
            this.pos += 9;
            this.finishToken(tt_cdata_start);
            return true;
        }else if(code===93 && this.input.charCodeAt(pos+1)===93 && this.input.charCodeAt(pos+2)===62 ){
            this.pos += 3;
            this.finishToken(tt_cdata_end);
            return true;
        }
    }

    updateContext(prevType) {
        if( this.type === tt.slash && prevType === tok.jsxTagStart ){
            const context = this.context[ this.context.length-3 ];
            if( context === tc_script_expr || context === tc_style_expr ){
                this.context.splice( this.context.length-3, 1)
            }         
        }else if( prevType === tt_cdata_start && this.curContext() === tc_cdata_expr ){
            this.context.pop();
        }
        super.updateContext(prevType);
        if(this.exprAllowed && this.context[this.context.length-2] === tc_type_statement ){
            this.exprAllowed = false
        }else if( !this.exprAllowed ){
            const ctx = this.curContext();
            if( ctx === tc_script_expr ){
                this.exprAllowed = this.type === tt.braceR || this.type === tok.jsxTagEnd; 
            }else if( ctx === tokContexts.b_stat || ctx === tokContexts.b_expr){
                this.exprAllowed = this.type === tok.jsxTagEnd;
            }
        }
    }
}


Parser.extend(function(){
    return SyntaxParser;
});

SyntaxParser.parse = function parse (input, options) {
    options = Object.assign( {preserveParens:true}, options||{} )
    const obj = new SyntaxParser(options, input)
    const res = obj.parse();
    return res;
};

SyntaxParser.parseExpressionAt = function parseExpressionAt (input, pos, options) {
    options = Object.assign( {preserveParens:true}, options||{} )
    var parser = new SyntaxParser(options, input, pos);
    if( options.isMethod ){
       parser.enterScope( functionFlags( !!options.isAsync, !!options.generator) | SCOPE_SUPER | ( !!options.allowDirectSuper ? SCOPE_DIRECT_SUPER : 0));
    }
    parser.nextToken();
    return parser.parseExpression();
};

SyntaxParser.parseBindingAtom = function parseBindingAtom (input, pos=0, options={}) {
    options = Object.assign( {preserveParens:true}, options||{} )
    var parser = new SyntaxParser(options, input, pos);
    parser.nextToken();
    return parser.parseBindingAtom();
};

const parseJSX = Parser.extend( jsx({allowNamespaces:true,allowNamespacedObjects:true}) );
SyntaxParser.jsx=function jsx(input, options){
    return parseJSX.parse(input, options);
}

module.exports= {
    acorn,
    parseJSX,
    Parser:SyntaxParser,
    // lessParser:(function(){
    //     const less = require('less');
    //     const defaultOptions = lodash.merge({}, less.options);
    //     return {
    //         _options:defaultOptions,
    //         input:'',
    //         option( options ){
    //             if( options ){
    //                 this._options = lodash.merge(this._options, options);
    //             }
    //             return this._options;
    //         },
    //         render(input){

    //         },
    //         getRangeByNode(node){
    //             if( node && this.input && node._index >= 0 ){
    //                const liens = this.input.substr(0,node._index).split(/\n/);
    //                return {
    //                    line:liens.length,
    //                    column:liens[liens.length].length
    //                }
    //             }
    //             return null;
    //         },
    //         toCSS( rootNode, imports){
    //             const tree = new less.ParseTree(rootNode, imports || this.imports )
    //             return tree.toCSS(this.callOptions || this._options);
    //         },
    //         parse(input, callback){
    //             this.input = input;
    //             less.parse(input, this._options, (err, root, imports, options)=>{
    //                 this.imports = imports;
    //                 this.callOptions = options;
    //                 callback(err, root, imports, options)
    //             })
    //         }
    //     };
    // }())
}