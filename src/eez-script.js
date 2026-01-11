/**
 * EEZ Script - A JavaScript-like scripting language
 * 
 * This provides a controlled execution environment with type checking and security features.
 * Features: functions, variables (let/const), expressions, function calls, if/for/while loops,
 * typed parameters, automatic string-to-cstring conversion, LVGL integration
 */

// ============================================================================
// LEXER (Tokenizer)
// ============================================================================

class Lexer {
    constructor(input) {
        this.input = input;
        this.pos = 0;
        this.line = 1;
        this.column = 1;
    }

    peek() {
        return this.input[this.pos];
    }

    advance() {
        const ch = this.input[this.pos++];
        if (ch === '\n') {
            this.line++;
            this.column = 1;
        } else {
            this.column++;
        }
        return ch;
    }

    skipWhitespace() {
        while (this.pos < this.input.length && /\s/.test(this.peek())) {
            this.advance();
        }
    }

    skipLineComment() {
        while (this.pos < this.input.length && this.peek() !== '\n') {
            this.advance();
        }
    }

    skipBlockComment() {
        this.advance(); // skip *
        while (this.pos < this.input.length) {
            if (this.peek() === '*' && this.input[this.pos + 1] === '/') {
                this.advance(); // skip *
                this.advance(); // skip /
                break;
            }
            this.advance();
        }
    }

    readNumber() {
        const startLine = this.line;
        const startColumn = this.column;
        let num = '';

        // Check for hexadecimal (0x or 0X prefix)
        if (this.peek() === '0' && (this.input[this.pos + 1] === 'x' || this.input[this.pos + 1] === 'X')) {
            num += this.advance(); // '0'
            num += this.advance(); // 'x' or 'X'
            while (this.pos < this.input.length && /[0-9a-fA-F]/.test(this.peek())) {
                num += this.advance();
            }
            return { type: 'NUMBER', value: parseInt(num, 16), line: startLine, column: startColumn };
        }

        // Regular decimal number
        while (this.pos < this.input.length && /[0-9.]/.test(this.peek())) {
            num += this.advance();
        }
        return { type: 'NUMBER', value: parseFloat(num), line: startLine, column: startColumn };
    }

    readString(quote) {
        const startLine = this.line;
        const startColumn = this.column;
        this.advance(); // skip opening quote
        let str = '';
        while (this.pos < this.input.length && this.peek() !== quote) {
            if (this.peek() === '\\') {
                this.advance();
                const next = this.advance();
                switch (next) {
                    case 'n': str += '\n'; break;
                    case 't': str += '\t'; break;
                    case 'r': str += '\r'; break;
                    case '\\': str += '\\'; break;
                    case '"': str += '"'; break;
                    case "'": str += "'"; break;
                    default: str += next;
                }
            } else {
                str += this.advance();
            }
        }
        this.advance(); // skip closing quote
        return { type: 'STRING', value: str, line: startLine, column: startColumn };
    }

    readIdentifier() {
        const startLine = this.line;
        const startColumn = this.column;
        const startPos = this.pos;
        let id = '';
        while (this.pos < this.input.length && /[a-zA-Z0-9_]/.test(this.peek())) {
            id += this.advance();
        }

        // Check for keywords
        const keywords = {
            'function': 'FUNCTION',
            'return': 'RETURN',
            'if': 'IF',
            'else': 'ELSE',
            'for': 'FOR',
            'while': 'WHILE',
            'let': 'LET',
            'const': 'CONST',
            'true': 'TRUE',
            'false': 'FALSE',
            'null': 'NULL',
            'undefined': 'UNDEFINED',
            'number': 'TYPE_NUMBER',
            'bool': 'TYPE_BOOL',
            'string': 'TYPE_STRING',
            'cstring': 'TYPE_CSTRING',
            'lv_color': 'TYPE_LV_COLOR'
        };

        return { type: keywords[id] || 'IDENTIFIER', value: id, line: startLine, column: startColumn, length: this.pos - startPos };
    }

    nextToken() {
        this.skipWhitespace();

        const tokenLine = this.line;
        const tokenColumn = this.column;

        if (this.pos >= this.input.length) {
            return { type: 'EOF', line: tokenLine, column: tokenColumn };
        }

        const ch = this.peek();

        // Comments
        if (ch === '/' && this.input[this.pos + 1] === '/') {
            this.skipLineComment();
            return this.nextToken();
        }

        if (ch === '/' && this.input[this.pos + 1] === '*') {
            this.advance(); // skip /
            this.skipBlockComment();
            return this.nextToken();
        }

        // Numbers
        if (/[0-9]/.test(ch)) {
            return this.readNumber();
        }

        // Strings
        if (ch === '"' || ch === "'") {
            return this.readString(ch);
        }

        // Identifiers and keywords
        if (/[a-zA-Z_]/.test(ch)) {
            return this.readIdentifier();
        }

        // Operators and punctuation
        const doubleChar = ch + this.input[this.pos + 1];
        const operators2 = ['==', '!=', '<=', '>=', '&&', '||', '++', '--', '+=', '-=', '*=', '/='];
        if (operators2.includes(doubleChar)) {
            this.advance();
            this.advance();
            return { type: doubleChar, value: doubleChar, line: tokenLine, column: tokenColumn, length: 2 };
        }

        const singleChar = {
            '(': 'LPAREN', ')': 'RPAREN',
            '{': 'LBRACE', '}': 'RBRACE',
            '[': 'LBRACKET', ']': 'RBRACKET',
            ';': 'SEMICOLON', ',': 'COMMA',
            '.': 'DOT', ':': 'COLON',
            '=': 'ASSIGN',
            '+': 'PLUS', '-': 'MINUS',
            '*': 'STAR', '/': 'SLASH',
            '%': 'PERCENT',
            '<': 'LT', '>': 'GT',
            '!': 'NOT',
            '&': 'AMP', '|': 'PIPE', '^': 'CARET'
        };

        if (singleChar[ch]) {
            this.advance();
            return { type: singleChar[ch], value: ch, line: tokenLine, column: tokenColumn, length: 1 };
        }

        throw new Error(`Syntax error: Unexpected character '${ch}' at line ${this.line}:${this.column}`);
    }

    tokenize() {
        const tokens = [];
        let token;
        while ((token = this.nextToken()).type !== 'EOF') {
            tokens.push(token);
        }
        tokens.push(token); // Add EOF
        return tokens;
    }
}

// ============================================================================
// PARSER (AST Builder)
// ============================================================================

class Parser {
    constructor(tokens) {
        this.tokens = tokens;
        this.pos = 0;
    }

    peek() {
        return this.tokens[this.pos];
    }

    advance() {
        return this.tokens[this.pos++];
    }

    expect(type) {
        const token = this.advance();
        if (token.type !== type) {
            const location = token.line && token.column ? ` at line ${token.line}:${token.column}` : '';
            throw new Error(`Syntax error: Expected ${type} but got ${token.type}${location}`);
        }
        return token;
    }

    // Program = Statement*
    parseProgram() {
        const statements = [];
        while (this.peek().type !== 'EOF') {
            statements.push(this.parseStatement());
        }
        return { type: 'Program', body: statements };
    }

    // Statement = FunctionDeclaration | IfStatement | ForStatement | WhileStatement | ReturnStatement | ExpressionStatement
    parseStatement() {
        const token = this.peek();

        if (token.type === 'FUNCTION') {
            return this.parseFunctionDeclaration();
        }
        if (token.type === 'IF') {
            return this.parseIfStatement();
        }
        if (token.type === 'FOR') {
            return this.parseForStatement();
        }
        if (token.type === 'WHILE') {
            return this.parseWhileStatement();
        }
        if (token.type === 'RETURN') {
            return this.parseReturnStatement();
        }
        if (token.type === 'LET' || token.type === 'CONST') {
            return this.parseVariableDeclaration();
        }
        if (token.type === 'LBRACE') {
            return this.parseBlockStatement();
        }

        return this.parseExpressionStatement();
    }

    // FunctionDeclaration = 'function' Identifier '(' Parameters? ')' (':' Type)? BlockStatement
    parseFunctionDeclaration() {
        this.expect('FUNCTION');
        const name = this.expect('IDENTIFIER').value;
        this.expect('LPAREN');

        const params = [];
        if (this.peek().type !== 'RPAREN') {
            // Parse parameter with optional type annotation
            const paramName = this.expect('IDENTIFIER').value;
            let paramType = null;
            if (this.peek().type === 'COLON') {
                this.advance(); // skip ':'
                paramType = this.parseType();
            }
            params.push({ name: paramName, type: paramType });

            while (this.peek().type === 'COMMA') {
                this.advance();
                const pName = this.expect('IDENTIFIER').value;
                let pType = null;
                if (this.peek().type === 'COLON') {
                    this.advance();
                    pType = this.parseType();
                }
                params.push({ name: pName, type: pType });
            }
        }

        this.expect('RPAREN');

        // Parse optional return type
        let returnType = null;
        if (this.peek().type === 'COLON') {
            this.advance();
            returnType = this.parseType();
        }

        const body = this.parseBlockStatement();

        return { type: 'FunctionDeclaration', name, params, returnType, body };
    }

    // Type = 'number' | 'bool' | 'string' | 'cstring' | 'lv_color' | Identifier
    parseType() {
        const token = this.advance();
        if (token.type === 'TYPE_NUMBER') {
            return 'number';
        } else if (token.type === 'TYPE_BOOL') {
            return 'bool';
        } else if (token.type === 'TYPE_STRING') {
            return 'string';
        } else if (token.type === 'TYPE_CSTRING') {
            return 'cstring';
        } else if (token.type === 'TYPE_LV_COLOR') {
            return 'lv_color';
        } else if (token.type === 'FUNCTION') {
            return 'function';
        } else if (token.type === 'IDENTIFIER') {
            return token.value; // Custom type like lv_obj
        } else {
            const location = token.line && token.column ? ` at line ${token.line}:${token.column}` : '';
            throw new Error(`Syntax error: Expected type but got ${token.type}${location}`);
        }
    }

    // BlockStatement = '{' Statement* '}'
    parseBlockStatement() {
        const token = this.peek();
        if (token.type !== 'LBRACE') {
            const location = token.line && token.column ? ` at line ${token.line}:${token.column}` : '';
            throw new Error(`Syntax error: Expected { but got ${token.type}${location}. Function bodies must be wrapped in curly braces { }`);
        }
        this.expect('LBRACE');
        const statements = [];
        while (this.peek().type !== 'RBRACE') {
            statements.push(this.parseStatement());
        }
        this.expect('RBRACE');
        return { type: 'BlockStatement', body: statements };
    }

    // VariableDeclaration = ('let' | 'const') Identifier (':' Type)? ('=' Expression)? ';'
    parseVariableDeclaration() {
        const kind = this.advance().type; // LET or CONST
        const name = this.expect('IDENTIFIER').value;
        let varType = null;
        let init = null;

        // Parse optional type annotation
        if (this.peek().type === 'COLON') {
            this.advance();
            varType = this.parseType();
        }

        if (this.peek().type === 'ASSIGN') {
            this.advance();
            init = this.parseExpression();
        }

        if (this.peek().type === 'SEMICOLON') {
            this.advance();
        }

        return { type: 'VariableDeclaration', kind: kind.toLowerCase(), name, varType, init };
    }

    // IfStatement = 'if' '(' Expression ')' Statement ('else' Statement)?
    parseIfStatement() {
        this.expect('IF');
        this.expect('LPAREN');
        const test = this.parseExpression();
        this.expect('RPAREN');
        const consequent = this.parseStatement();
        let alternate = null;

        if (this.peek().type === 'ELSE') {
            this.advance();
            alternate = this.parseStatement();
        }

        return { type: 'IfStatement', test, consequent, alternate };
    }

    // ForStatement = 'for' '(' (VariableDeclaration | ExpressionStatement) Expression ';' Expression ')' Statement
    parseForStatement() {
        this.expect('FOR');
        this.expect('LPAREN');

        let init = null;
        if (this.peek().type === 'LET' || this.peek().type === 'CONST') {
            init = this.parseVariableDeclaration();
        } else if (this.peek().type !== 'SEMICOLON') {
            init = this.parseExpression();
            if (this.peek().type === 'SEMICOLON') {
                this.advance();
            }
        } else {
            this.advance(); // skip semicolon
        }

        const test = this.peek().type !== 'SEMICOLON' ? this.parseExpression() : null;
        this.expect('SEMICOLON');

        const update = this.peek().type !== 'RPAREN' ? this.parseExpression() : null;
        this.expect('RPAREN');

        const body = this.parseStatement();

        return { type: 'ForStatement', init, test, update, body };
    }

    // WhileStatement = 'while' '(' Expression ')' Statement
    parseWhileStatement() {
        this.expect('WHILE');
        this.expect('LPAREN');
        const test = this.parseExpression();
        this.expect('RPAREN');
        const body = this.parseStatement();

        return { type: 'WhileStatement', test, body };
    }

    // ReturnStatement = 'return' Expression? ';'
    parseReturnStatement() {
        this.expect('RETURN');
        let argument = null;

        if (this.peek().type !== 'SEMICOLON' && this.peek().type !== 'RBRACE') {
            argument = this.parseExpression();
        }

        if (this.peek().type === 'SEMICOLON') {
            this.advance();
        }

        return { type: 'ReturnStatement', argument };
    }

    // ExpressionStatement = Expression ';'
    parseExpressionStatement() {
        const expr = this.parseExpression();
        if (this.peek().type === 'SEMICOLON') {
            this.advance();
        }
        return { type: 'ExpressionStatement', expression: expr };
    }

    // Expression = AssignmentExpression
    parseExpression() {
        return this.parseAssignmentExpression();
    }

    // AssignmentExpression = LogicalOrExpression (('=' | '+=' | '-=') AssignmentExpression)?
    parseAssignmentExpression() {
        const left = this.parseLogicalOrExpression();

        if (['ASSIGN', '+=', '-=', '*=', '/='].includes(this.peek().type)) {
            const operator = this.advance().value;
            const right = this.parseAssignmentExpression();
            return { type: 'AssignmentExpression', operator, left, right };
        }

        return left;
    }

    // LogicalOrExpression = LogicalAndExpression ('||' LogicalAndExpression)*
    parseLogicalOrExpression() {
        let left = this.parseLogicalAndExpression();

        while (this.peek().type === '||') {
            const operator = this.advance().value;
            const right = this.parseLogicalAndExpression();
            left = { type: 'BinaryExpression', operator, left, right };
        }

        return left;
    }

    // LogicalAndExpression = BitwiseOrExpression ('&&' BitwiseOrExpression)*
    parseLogicalAndExpression() {
        let left = this.parseBitwiseOrExpression();

        while (this.peek().type === '&&') {
            const operator = this.advance().value;
            const right = this.parseBitwiseOrExpression();
            left = { type: 'BinaryExpression', operator, left, right };
        }

        return left;
    }

    // BitwiseOrExpression = BitwiseXorExpression ('|' BitwiseXorExpression)*
    parseBitwiseOrExpression() {
        let left = this.parseBitwiseXorExpression();

        while (this.peek().type === 'PIPE') {
            const operator = this.advance().value;
            const right = this.parseBitwiseXorExpression();
            left = { type: 'BinaryExpression', operator, left, right };
        }

        return left;
    }

    // BitwiseXorExpression = BitwiseAndExpression ('^' BitwiseAndExpression)*
    parseBitwiseXorExpression() {
        let left = this.parseBitwiseAndExpression();

        while (this.peek().type === 'CARET') {
            const operator = this.advance().value;
            const right = this.parseBitwiseAndExpression();
            left = { type: 'BinaryExpression', operator, left, right };
        }

        return left;
    }

    // BitwiseAndExpression = EqualityExpression ('&' EqualityExpression)*
    parseBitwiseAndExpression() {
        let left = this.parseEqualityExpression();

        while (this.peek().type === 'AMP') {
            const operator = this.advance().value;
            const right = this.parseEqualityExpression();
            left = { type: 'BinaryExpression', operator, left, right };
        }

        return left;
    }

    // EqualityExpression = RelationalExpression (('==' | '!=') RelationalExpression)*
    parseEqualityExpression() {
        let left = this.parseRelationalExpression();

        while (['==', '!='].includes(this.peek().type)) {
            const operator = this.advance().value;
            const right = this.parseRelationalExpression();
            left = { type: 'BinaryExpression', operator, left, right };
        }

        return left;
    }

    // RelationalExpression = AdditiveExpression (('<' | '>' | '<=' | '>=') AdditiveExpression)*
    parseRelationalExpression() {
        let left = this.parseAdditiveExpression();

        while (['LT', 'GT', '<=', '>='].includes(this.peek().type)) {
            const operator = this.advance().value;
            const right = this.parseAdditiveExpression();
            left = { type: 'BinaryExpression', operator, left, right };
        }

        return left;
    }

    // AdditiveExpression = MultiplicativeExpression (('+' | '-') MultiplicativeExpression)*
    parseAdditiveExpression() {
        let left = this.parseMultiplicativeExpression();

        while (['PLUS', 'MINUS'].includes(this.peek().type)) {
            const operator = this.advance().value;
            const right = this.parseMultiplicativeExpression();
            left = { type: 'BinaryExpression', operator, left, right };
        }

        return left;
    }

    // MultiplicativeExpression = UnaryExpression (('*' | '/' | '%') UnaryExpression)*
    parseMultiplicativeExpression() {
        let left = this.parseUnaryExpression();

        while (['STAR', 'SLASH', 'PERCENT'].includes(this.peek().type)) {
            const operator = this.advance().value;
            const right = this.parseUnaryExpression();
            left = { type: 'BinaryExpression', operator, left, right };
        }

        return left;
    }

    // UnaryExpression = ('!' | '-' | '++' | '--') UnaryExpression | PostfixExpression
    parseUnaryExpression() {
        if (['NOT', 'MINUS', '++', '--'].includes(this.peek().type)) {
            const operator = this.advance().value;
            const argument = this.parseUnaryExpression();
            return { type: 'UnaryExpression', operator, prefix: true, argument };
        }

        return this.parsePostfixExpression();
    }

    // PostfixExpression = PrimaryExpression ('(' Arguments? ')' | '.' Identifier | '[' Expression ']' | '++' | '--')*
    parsePostfixExpression() {
        let expr = this.parsePrimaryExpression();

        while (true) {
            const token = this.peek();

            if (token.type === 'LPAREN') {
                // Function call
                const callToken = this.advance();
                const args = [];
                if (this.peek().type !== 'RPAREN') {
                    args.push(this.parseExpression());
                    while (this.peek().type === 'COMMA') {
                        this.advance();
                        args.push(this.parseExpression());
                    }
                }
                this.expect('RPAREN');
                expr = { 
                    type: 'CallExpression', 
                    callee: expr, 
                    arguments: args,
                    loc: expr.loc || { line: callToken.line, column: callToken.column, length: callToken.length }
                };
            } else if (token.type === 'DOT') {
                // Member access
                this.advance();
                const property = this.expect('IDENTIFIER').value;
                expr = { type: 'MemberExpression', object: expr, property, computed: false };
            } else if (token.type === 'LBRACKET') {
                // Computed member access
                this.advance();
                const property = this.parseExpression();
                this.expect('RBRACKET');
                expr = { type: 'MemberExpression', object: expr, property, computed: true };
            } else if (token.type === '++' || token.type === '--') {
                const operator = this.advance().value;
                expr = { type: 'UpdateExpression', operator, prefix: false, argument: expr };
            } else {
                break;
            }
        }

        return expr;
    }

    // PrimaryExpression = Identifier | Literal | '(' Expression ')'
    parsePrimaryExpression() {
        const token = this.peek();

        if (token.type === 'IDENTIFIER') {
            const idToken = this.advance();
            return { type: 'Identifier', name: idToken.value, loc: { line: idToken.line, column: idToken.column, length: idToken.length } };
        }

        if (token.type === 'NUMBER') {
            const numToken = this.advance();
            return { type: 'Literal', value: numToken.value, loc: { line: numToken.line, column: numToken.column, length: numToken.length } };
        }

        if (token.type === 'STRING') {
            const strToken = this.advance();
            return { type: 'Literal', value: strToken.value, loc: { line: strToken.line, column: strToken.column, length: strToken.length } };
        }

        if (token.type === 'TRUE') {
            const trueToken = this.advance();
            return { type: 'Literal', value: true, loc: { line: trueToken.line, column: trueToken.column, length: trueToken.length } };
        }

        if (token.type === 'FALSE') {
            const falseToken = this.advance();
            return { type: 'Literal', value: false, loc: { line: falseToken.line, column: falseToken.column, length: falseToken.length } };
        }

        if (token.type === 'NULL') {
            this.advance();
            return { type: 'Literal', value: null };
        }

        if (token.type === 'UNDEFINED') {
            this.advance();
            return { type: 'Literal', value: undefined };
        }

        if (token.type === 'LPAREN') {
            this.advance();
            const expr = this.parseExpression();
            this.expect('RPAREN');
            return expr;
        }

        const location = token.line && token.column ? ` at line ${token.line}:${token.column}` : '';
        throw new Error(`Syntax error: Unexpected token ${token.type}${location}`);
    }
}

// ============================================================================
// INTERPRETER (AST Evaluator)
// ============================================================================

class Interpreter {
    constructor(globals, lvgl, constants, allowedFunctions) {
        // Process globals: extract functions and their type specifications
        // globals can be:
        // - plain values/functions: { funcName: function }
        // - functions with types: { funcName: { function: fn, params: [...], returnType: type } }
        this.globalFunctionTypes = {};
        this.globals = this.processGlobalsObject(globals, '');

        this.lvgl = lvgl;
        this.constants = constants;

        // allowedFunctions can be:
        // - null: allow all functions
        // - array: whitelist of function names
        // - object: { functionName: argCount } for whitelist with arg count validation
        // - object: { functionName: { params: [types], returnType: type } } for full type checking
        this.allowedFunctions = null;
        this.functionArgCounts = {};
        this.functionTypes = {};

        if (allowedFunctions) {
            if (Array.isArray(allowedFunctions)) {
                // Array format: just function names
                this.allowedFunctions = allowedFunctions;
            } else if (typeof allowedFunctions === 'object') {
                // Object format with type info
                this.allowedFunctions = Object.keys(allowedFunctions);
                for (const funcName in allowedFunctions) {
                    const spec = allowedFunctions[funcName];
                    if (typeof spec === 'number' || (typeof spec === 'object' && ('min' in spec || 'max' in spec))) {
                        // Old format: just arg count
                        this.functionArgCounts[funcName] = spec;
                    } else if (typeof spec === 'object' && 'params' in spec) {
                        // New format: full type info
                        this.functionTypes[funcName] = spec;
                        this.functionArgCounts[funcName] = spec.params.length;
                    }
                }
            }
        }

        this.globalScope = {};
        this.functions = {};
        this.variableTypes = {};
        this.sourceCode = '';
        this.currentNode = null;
        this._colorBuffer = null; // Pre-allocated buffer for lv_color operations
        this.eventManager = null; // Will be set by runtime if event handling is supported
    }

    // Recursively process globals object to extract functions and type info
    processGlobalsObject(obj, pathPrefix) {
        if (!obj) return {};

        const result = {};
        for (const key in obj) {
            const value = obj[key];
            const fullPath = pathPrefix ? `${pathPrefix}.${key}` : key;

            if (typeof value === 'object' && value !== null && 'function' in value) {
                // Extract function and type info
                result[key] = value.function;
                if (value.params || value.returnType) {
                    this.globalFunctionTypes[fullPath] = {
                        params: value.params || [],
                        returnType: value.returnType
                    };
                }
            } else if (typeof value === 'object' && value !== null && typeof value !== 'function') {
                // Recursively process nested objects
                result[key] = this.processGlobalsObject(value, fullPath);
            } else {
                // Plain value or function
                result[key] = value;
            }
        }
        return result;
    }

    // Build path string from MemberExpression for global function lookup
    getMemberExpressionPath(node) {
        if (node.type === 'Identifier') {
            return node.name;
        } else if (node.type === 'MemberExpression' && !node.computed) {
            const objectPath = this.getMemberExpressionPath(node.object);
            return objectPath ? `${objectPath}.${node.property}` : null;
        }
        return null;
    }

    // Control flow exception for return statements
    createReturnValue(value) {
        return { __return: true, value };
    }

    isReturnValue(value) {
        return value && value.__return === true;
    }

    createRuntimeError(message, node = null) {
        const errorNode = node || this.currentNode;
        let errorMsg = message;

        // Add source context if available (but don't duplicate line/column in message)
        if (errorNode && errorNode.loc) {
            const line = errorNode.loc.line;
            const col = errorNode.loc.column; // Already 1-based from lexer
            const len = errorNode.loc.length || 1; // Token length from lexer

            // Add "At line X, column Y, length Z:" prefix for error extraction with Runtime error label
            errorMsg = `At line ${line}, column ${col}, length ${len}: Runtime error: ${message}`;
            
            // Don't add source code snippet - it clutters the display
        } else {
            // No location info, just add Runtime error prefix
            errorMsg = `Runtime error: ${message}`;
        }

        return new Error(errorMsg);
    }

    execute(ast) {
        this.visitProgram(ast);
    }

    visitProgram(node) {
        for (const statement of node.body) {
            this.visitStatement(statement, this.globalScope);
        }
    }

    visitStatement(node, scope) {
        switch (node.type) {
            case 'FunctionDeclaration':
                return this.visitFunctionDeclaration(node, scope);
            case 'VariableDeclaration':
                return this.visitVariableDeclaration(node, scope);
            case 'ExpressionStatement':
                return this.visitExpressionStatement(node, scope);
            case 'BlockStatement':
                return this.visitBlockStatement(node, scope);
            case 'IfStatement':
                return this.visitIfStatement(node, scope);
            case 'ForStatement':
                return this.visitForStatement(node, scope);
            case 'WhileStatement':
                return this.visitWhileStatement(node, scope);
            case 'ReturnStatement':
                return this.visitReturnStatement(node, scope);
            default:
                throw this.createRuntimeError(`Unknown statement type: ${node.type}`, node);
        }
    }

    visitFunctionDeclaration(node, scope) {
        this.functions[node.name] = node;
        scope[node.name] = (...args) => this.callFunction(node.name, args);

        // Store parameter types for this function
        if (node.params && node.params.length > 0 && node.params[0].type) {
            this.variableTypes[node.name] = {
                params: node.params.map(p => p.type),
                returnType: node.returnType
            };
        }
    }

    visitVariableDeclaration(node, scope) {
        let value = node.init ? this.visitExpression(node.init, scope) : undefined;

        // Type check if type annotation is present
        if (node.varType && value !== undefined) {
            const actualType = this.getValueType(value);

            // Auto-convert string to cstring
            if (node.varType === 'cstring' && actualType === 'string') {
                value = this.convertStringToCString(value);
            } else if (!this.isTypeCompatible(actualType, node.varType)) {
                throw this.createRuntimeError(`Type mismatch: Cannot assign ${actualType} to ${node.varType}`, node);
            }
        }

        scope[node.name] = value;

        // Store variable type
        if (node.varType) {
            this.variableTypes[node.name] = node.varType;
        }
    }

    getValueType(value) {
        // Note: cstring is stored as a number (pointer), so we can't distinguish it from number at runtime
        // Type checking for cstring happens at assignment/call time
        if (typeof value === 'number') return 'number';
        if (typeof value === 'boolean') return 'bool';
        if (typeof value === 'string') return 'string';
        if (typeof value === 'function') return 'function';
        if (value === null) return 'null';
        if (value === undefined) return 'undefined';
        // Check if it's an LVGL object (represented as object with type property)
        if (typeof value === 'object' && value !== null && value.type) {
            // Map object types to lv_obj compatible types
            if (value.type === 'obj' || value.type === 'button' || value.type === 'label') {
                return 'lv_obj';
            }
            return value.type;
        }
        return 'unknown';
    }

    isTypeCompatible(actualType, expectedType) {
        if (expectedType === actualType) return true;
        // Function types are compatible
        if (expectedType === 'function' && actualType === 'function') return true;
        // All lv_* widget types are compatible with lv_obj
        if (expectedType === 'lv_obj' && actualType.startsWith('lv_')) return true;
        // lv_obj is also compatible with number (since it's represented as pointer/number in C)
        if (expectedType === 'lv_obj' && actualType === 'number') return true;
        // cstring is stored as number (pointer) so they're compatible
        if (expectedType === 'cstring' && actualType === 'number') return true;
        if (expectedType === 'number' && actualType === 'cstring') return true;
        // lv_color is stored as number at runtime but is a distinct type in C
        if (expectedType === 'lv_color' && actualType === 'number') return true;
        if (expectedType === 'number' && actualType === 'lv_color') return true;
        return false;
    }

    convertStringToCString(value) {
        // Convert JavaScript string to C string using System.stringToNewUTF8
        if (!this.globals.System || !this.globals.System.stringToNewUTF8) {
            throw this.createRuntimeError('System.stringToNewUTF8 is required for cstring conversion but is not available', this.currentNode);
        }
        return this.globals.System.stringToNewUTF8(value);
    }

    visitExpressionStatement(node, scope) {
        this.currentNode = node;
        return this.visitExpression(node.expression, scope);
    }

    visitBlockStatement(node, scope) {
        this.currentNode = node;
        const blockScope = Object.create(scope);

        for (const statement of node.body) {
            const result = this.visitStatement(statement, blockScope);
            if (this.isReturnValue(result)) {
                return result;
            }
        }
    }

    visitIfStatement(node, scope) {
        const test = this.visitExpression(node.test, scope);
        if (test) {
            return this.visitStatement(node.consequent, scope);
        } else if (node.alternate) {
            return this.visitStatement(node.alternate, scope);
        }
    }

    visitForStatement(node, scope) {
        const forScope = Object.create(scope);

        if (node.init) {
            if (node.init.type === 'VariableDeclaration') {
                this.visitStatement(node.init, forScope);
            } else {
                this.visitExpression(node.init, forScope);
            }
        }

        while (true) {
            if (node.test) {
                const test = this.visitExpression(node.test, forScope);
                if (!test) break;
            }

            const result = this.visitStatement(node.body, forScope);
            if (this.isReturnValue(result)) {
                return result;
            }

            if (node.update) {
                this.visitExpression(node.update, forScope);
            }
        }
    }

    visitWhileStatement(node, scope) {
        while (true) {
            const test = this.visitExpression(node.test, scope);
            if (!test) break;

            const result = this.visitStatement(node.body, scope);
            if (this.isReturnValue(result)) {
                return result;
            }
        }
    }

    visitReturnStatement(node, scope) {
        const value = node.argument ? this.visitExpression(node.argument, scope) : undefined;
        return this.createReturnValue(value);
    }

    visitExpression(node, scope) {
        this.currentNode = node;
        switch (node.type) {
            case 'Literal':
                return node.value;
            case 'Identifier':
                return this.visitIdentifier(node, scope);
            case 'BinaryExpression':
                return this.visitBinaryExpression(node, scope);
            case 'UnaryExpression':
                return this.visitUnaryExpression(node, scope);
            case 'UpdateExpression':
                return this.visitUpdateExpression(node, scope);
            case 'AssignmentExpression':
                return this.visitAssignmentExpression(node, scope);
            case 'CallExpression':
                return this.visitCallExpression(node, scope);
            case 'MemberExpression':
                return this.visitMemberExpression(node, scope);
            default:
                throw this.createRuntimeError(`Unknown expression type: ${node.type}`, node);
        }
    }

    visitIdentifier(node, scope) {
        // Check if it's an LV_* constant
        if (node.name.startsWith('LV_')) {
            if (this.constants && node.name in this.constants) {
                return this.constants[node.name];
            }
            throw this.createRuntimeError(`Unknown constant: ${node.name}`, node);
        }
        
        if (node.name in this.globals) {
            return this.globals[node.name];
        }

        // Look up in scope chain
        let currentScope = scope;
        while (currentScope) {
            if (node.name in currentScope) {
                return currentScope[node.name];
            }
            currentScope = Object.getPrototypeOf(currentScope);
        }

        throw this.createRuntimeError(`Undefined variable: ${node.name}`, node);
    }

    visitBinaryExpression(node, scope) {
        const left = this.visitExpression(node.left, scope);
        const right = this.visitExpression(node.right, scope);

        switch (node.operator) {
            case '+': return left + right;
            case '-': return left - right;
            case '*': return left * right;
            case '/': return left / right;
            case '%': return left % right;
            case '==': return left == right;
            case '!=': return left != right;
            case '<': return left < right;
            case '>': return left > right;
            case '<=': return left <= right;
            case '>=': return left >= right;
            case '&&': return left && right;
            case '||': return left || right;
            case '|': return left | right;
            case '&': return left & right;
            case '^': return left ^ right;
            default:
                throw this.createRuntimeError(`Unknown binary operator: ${node.operator}`, node);
        }
    }

    visitUnaryExpression(node, scope) {
        const argument = this.visitExpression(node.argument, scope);

        switch (node.operator) {
            case '!': return !argument;
            case '-': return -argument;
            case '++':
                if (node.prefix) {
                    return this.incrementVariable(node.argument, scope, 1, true);
                }
                break;
            case '--':
                if (node.prefix) {
                    return this.incrementVariable(node.argument, scope, -1, true);
                }
                break;
            default:
                throw this.createRuntimeError(`Unknown unary operator: ${node.operator}`, node);
        }
    }

    visitUpdateExpression(node, scope) {
        const delta = node.operator === '++' ? 1 : -1;
        return this.incrementVariable(node.argument, scope, delta, node.prefix);
    }

    incrementVariable(node, scope, delta, prefix) {
        if (node.type !== 'Identifier') {
            throw this.createRuntimeError('Can only increment variables', node);
        }

        const oldValue = this.visitIdentifier(node, scope);
        const newValue = oldValue + delta;

        // Find the scope that contains this variable and update it
        let currentScope = scope;
        while (currentScope) {
            if (Object.prototype.hasOwnProperty.call(currentScope, node.name)) {
                currentScope[node.name] = newValue;
                return prefix ? newValue : oldValue;
            }
            currentScope = Object.getPrototypeOf(currentScope);
        }

        // If not found in any scope, this shouldn't happen since visitIdentifier succeeded
        throw this.createRuntimeError(`Cannot increment undefined variable: ${node.name}`, node);
    }

    visitAssignmentExpression(node, scope) {
        const value = this.visitExpression(node.right, scope);

        if (node.left.type === 'Identifier') {
            const name = node.left.name;

            if (node.operator === '=') {
                // Find the scope that contains this variable and update it
                let currentScope = scope;
                while (currentScope) {
                    if (Object.prototype.hasOwnProperty.call(currentScope, name)) {
                        currentScope[name] = value;
                        return value;
                    }
                    currentScope = Object.getPrototypeOf(currentScope);
                }
                throw this.createRuntimeError(`Cannot assign to undefined variable: ${name}`, node);
            } else {
                // Compound assignment
                const oldValue = this.visitIdentifier(node.left, scope);
                let newValue;
                switch (node.operator) {
                    case '+=': newValue = oldValue + value; break;
                    case '-=': newValue = oldValue - value; break;
                    case '*=': newValue = oldValue * value; break;
                    case '/=': newValue = oldValue / value; break;
                    default: throw this.createRuntimeError(`Unknown assignment operator: ${node.operator}`, node);
                }

                let currentScope = scope;
                while (currentScope) {
                    if (Object.prototype.hasOwnProperty.call(currentScope, name)) {
                        currentScope[name] = newValue;
                        return newValue;
                    }
                    currentScope = Object.getPrototypeOf(currentScope);
                }
                throw this.createRuntimeError(`Cannot assign to undefined variable: ${name}`, node);
            }
        }

        throw this.createRuntimeError('Invalid assignment target', node);
    }

    visitCallExpression(node, scope) {
        // Evaluate callee
        let func;
        let thisContext = null;
        let functionName = null;
        let isGlobalFunction = false;

        if (node.callee.type === 'Identifier') {
            const name = node.callee.name;
            functionName = name;

            // Check if it's an lv_* function
            if (name.startsWith('lv_')) {
                // Check if function is in allowed list (if list is provided)
                if (this.allowedFunctions !== null && !this.allowedFunctions.includes(name)) {
                    throw this.createRuntimeError(`LVGL function not allowed: ${name}`, node);
                }

                // Resolve alias if this function is an alias for another
                // Also check for runtimeName (from static_inline) which specifies the actual WASM function
                let actualFuncName = name;
                if (this.functionTypes[name]) {
                    if (this.functionTypes[name].runtimeName) {
                        actualFuncName = this.functionTypes[name].runtimeName;
                    } else if (this.functionTypes[name].aliasOf) {
                        actualFuncName = this.functionTypes[name].aliasOf;
                    }
                }

                const lvglFuncName = '_' + actualFuncName;
                if (this.lvgl && typeof this.lvgl[lvglFuncName] === 'function') {
                    func = this.lvgl[lvglFuncName].bind(this.lvgl);
                } else {
                    const typeInfo = this.functionTypes[name];
                    throw this.createRuntimeError(`Unknown LVGL function: ${name}`, node);
                }
            } else {
                func = this.visitIdentifier(node.callee, scope);
                // Check if this is a global function
                if (name in this.globals && typeof this.globals[name] === 'function') {
                    isGlobalFunction = true;
                    functionName = name;
                }
            }
        } else if (node.callee.type === 'MemberExpression') {
            thisContext = this.visitExpression(node.callee.object, scope);
            const propName = node.callee.computed
                ? this.visitExpression(node.callee.property, scope)
                : node.callee.property;
            func = thisContext[propName];

            // Build full path for global function type checking
            if (node.callee.type === 'MemberExpression' && !node.callee.computed) {
                const path = this.getMemberExpressionPath(node.callee);
                if (path && path in this.globalFunctionTypes) {
                    isGlobalFunction = true;
                    functionName = path;
                }
            }
        } else {
            func = this.visitExpression(node.callee, scope);
        }

        // Evaluate arguments
        const args = node.arguments.map(arg => this.visitExpression(arg, scope));

        // Helper function to get the declared type of an argument
        const getArgumentDeclaredType = (argNode, scope) => {
            if (argNode.type === 'Identifier') {
                // Check if this identifier has a declared type in variableTypes
                let currentScope = scope;
                while (currentScope) {
                    if (argNode.name in currentScope) {
                        // Found the variable, check if we have type info
                        if (argNode.name in this.variableTypes) {
                            return this.variableTypes[argNode.name];
                        }
                        break;
                    }
                    currentScope = Object.getPrototypeOf(currentScope);
                }
            }
            return null;
        };

        // Validate types for global functions if specified
        if (isGlobalFunction && functionName in this.globalFunctionTypes) {
            const typeSpec = this.globalFunctionTypes[functionName];

            // Check argument count
            if (args.length !== typeSpec.params.length) {
                throw new Error(`Function ${functionName} expects ${typeSpec.params.length} argument(s), but got ${args.length}`);
            }

            // Check argument types and perform auto-conversion
            for (let i = 0; i < typeSpec.params.length; i++) {
                const expectedType = typeSpec.params[i];
                const argNode = node.arguments[i];

                // First check if argument has a declared type (e.g., variable with type annotation)
                const declaredType = getArgumentDeclaredType(argNode, scope);
                const actualType = declaredType || this.getValueType(args[i]);

                // Auto-convert string to cstring
                if (expectedType === 'cstring' && actualType === 'string') {
                    args[i] = this.convertStringToCString(args[i]);
                }
                // Auto-convert number to lv_color
                else if (expectedType === 'lv_color' && actualType === 'number') {
                    // Allocate color buffer on first use (reused for all color operations)
                    if (!this._colorBuffer && this.lvgl && this.lvgl._lv_malloc) {
                        this._colorBuffer = this.lvgl._lv_malloc(4);
                    }
                    // Call lv_color_hex with sret convention
                    this.lvgl._lv_color_hex(this._colorBuffer, args[i]);
                    args[i] = this._colorBuffer;
                }
                else if (!this.isTypeCompatible(actualType, expectedType)) {
                    const displayType = typeof evalArg === 'function' ? 'function' : actualType;
                    throw this.createRuntimeError(`Function ${functionName} parameter ${i + 1} expects type ${expectedType}, but got ${displayType}`, node);
                }
            }
        }

        // Validate argument count and types for lv_* functions if specified
        if (functionName && functionName.startsWith('lv_')) {
            // Check argument count
            if (functionName in this.functionArgCounts) {
                const expectedCount = this.functionArgCounts[functionName];
                if (typeof expectedCount === 'number') {
                    if (args.length !== expectedCount) {
                        throw new Error(`Function ${functionName} expects ${expectedCount} argument(s), but got ${args.length}`);
                    }
                } else if (typeof expectedCount === 'object' && ('min' in expectedCount || 'max' in expectedCount)) {
                    const min = expectedCount.min || 0;
                    const max = expectedCount.max || Infinity;
                    if (args.length < min || args.length > max) {
                        throw new Error(`Function ${functionName} expects ${min}-${max} arguments, but got ${args.length}`);
                    }
                }
            }

            // Check argument types
            if (functionName in this.functionTypes) {
                const typeSpec = this.functionTypes[functionName];
                for (let i = 0; i < typeSpec.params.length; i++) {
                    const expectedType = typeSpec.params[i];
                    const argNode = node.arguments[i];

                    // First check if argument has a declared type (e.g., variable with type annotation)
                    const declaredType = getArgumentDeclaredType(argNode, scope);
                    // If declaredType is an object with params (function signature), convert to 'function'
                    const normalizedDeclaredType = declaredType && typeof declaredType === 'object' && declaredType.params ? 'function' : declaredType;
                    const actualType = normalizedDeclaredType || this.getValueType(args[i]);

                    // Auto-convert string to cstring
                    if (expectedType === 'cstring' && actualType === 'string') {
                        args[i] = this.convertStringToCString(args[i]);
                    }
                    // Auto-convert number to lv_color
                    else if (expectedType === 'lv_color' && actualType === 'number') {
                        // Allocate color buffer on first use (reused for all color operations)
                        if (!this._colorBuffer && this.lvgl && this.lvgl._lv_malloc) {
                            this._colorBuffer = this.lvgl._lv_malloc(4);
                        }
                        // Call lv_color_hex with sret convention (only available in v9+)
                        if (!this.lvgl._lv_color_hex) {
                            throw this.createRuntimeError(`lv_color_hex is not available in this LVGL version. Use lv_color_make(r, g, b) instead, or upgrade to LVGL v9+`, argNode);
                        }
                        this.lvgl._lv_color_hex(this._colorBuffer, args[i]);
                        args[i] = this._colorBuffer;
                    }
                    else if (!this.isTypeCompatible(actualType, expectedType)) {
                        const displayType = typeof args[i] === 'function' ? 'function' : actualType;
                        throw this.createRuntimeError(`Function ${functionName} parameter ${i + 1} expects type ${expectedType}, but got ${displayType}`, argNode);
                    }
                }
            }
        }

        // Call function
        if (typeof func !== 'function') {
            throw this.createRuntimeError(`Cannot call non-function: ${typeof func}`, node);
        }

        // Special handling for lv_obj_add_event_cb
        if (functionName === 'lv_obj_add_event_cb') {
            // args: [obj, callback_function, event_code, user_data]
            // Register the callback with the event manager
            if (this.eventManager && typeof args[1] === 'function') {
                // EventManager handles the entire registration internally
                // It will call wasm._lv_obj_add_event_cb with the global dispatcher
                this.eventManager.register(args[0], args[2], args[1], scope);
                // Don't call the function again - return early
                return 0;
            }
        }

        // Special handling for lv_color_hex which uses sret calling convention
        if (functionName === 'lv_color_hex') {
            // Allocate color buffer on first use (reused for all color operations)
            if (!this._colorBuffer && this.lvgl && this.lvgl._lv_malloc) {
                this._colorBuffer = this.lvgl._lv_malloc(4);
            }
            // Call with sret: first param is pointer to result location
            func(this._colorBuffer, args[0]);
            return this._colorBuffer;
        }

        const returnValue = func.apply(thisContext, args);

        // Validate return type for global functions if specified
        if (isGlobalFunction && functionName in this.globalFunctionTypes) {
            const typeSpec = this.globalFunctionTypes[functionName];
            if (typeSpec.returnType && returnValue !== undefined) {
                const actualType = this.getValueType(returnValue);
                if (!this.isTypeCompatible(actualType, typeSpec.returnType)) {
                    throw new Error(`Function ${functionName} return type mismatch: expected ${typeSpec.returnType}, but got ${actualType}`);
                }
            }
        }

        return returnValue;
    }

    visitMemberExpression(node, scope) {
        const object = this.visitExpression(node.object, scope);
        const property = node.computed
            ? this.visitExpression(node.property, scope)
            : node.property;

        return object[property];
    }

    callFunction(name, args) {
        const func = this.functions[name];
        if (!func) {
            throw new Error(`Function not found: ${name}`);
        }

        // Create new scope for function execution
        const funcScope = Object.create(this.globalScope);

        // Bind parameters with type checking
        for (let i = 0; i < func.params.length; i++) {
            const param = func.params[i];
            const paramName = typeof param === 'string' ? param : param.name;
            const paramType = typeof param === 'object' ? param.type : null;

            // Type check parameter if type is specified
            if (paramType && args[i] !== undefined) {
                const actualType = this.getValueType(args[i]);

                // Auto-convert string to cstring
                if (paramType === 'cstring' && actualType === 'string') {
                    args[i] = this.convertStringToCString(args[i]);
                } else if (!this.isTypeCompatible(actualType, paramType)) {
                    throw new Error(`Function ${name} parameter ${i + 1} expects type ${paramType}, but got ${actualType}`);
                }
            }

            funcScope[paramName] = args[i];
        }

        // Execute function body
        const result = this.visitBlockStatement(func.body, funcScope);

        // Return value with type checking
        const returnValue = this.isReturnValue(result) ? result.value : undefined;

        if (func.returnType && returnValue !== undefined) {
            const actualType = this.getValueType(returnValue);
            if (!this.isTypeCompatible(actualType, func.returnType)) {
                throw new Error(`Function ${name} return type mismatch: expected ${func.returnType}, but got ${actualType}`);
            }
        }

        return returnValue;
    }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * EEZ Script version information
 */
const EEZ_SCRIPT_VERSION = '1.0.0';

function eez_script_version() {
    return {
        version: EEZ_SCRIPT_VERSION,
        name: 'EEZ Script',
        description: 'A JavaScript-like scripting language',
        features: [
            'TypeScript-like type annotations',
            'Automatic string-to-cstring conversion',
            'LVGL integration',
            'Function whitelisting',
            'Type checking'
        ]
    };
}

function eez_script_validate(script) {
    try {
        // Tokenize
        const lexer = new Lexer(script);
        const tokens = lexer.tokenize();

        // Parse
        const parser = new Parser(tokens);
        const ast = parser.parseProgram();

        return {
            valid: true,
            ast: ast
        };
    } catch (error) {
        return {
            valid: false,
            error: error.message
        };
    }
}

function eez_script_compile(script) {
    let ast;

    try {
        // Tokenize
        const lexer = new Lexer(script);
        const tokens = lexer.tokenize();

        // Parse
        const parser = new Parser(tokens);
        ast = parser.parseProgram();
    } catch (error) {
        throw error;
    }

    return {
        _ast: ast,
        _interpreter: null,
        _sourceCode: script,
        _allowedFunctions: null,

        // Initialize with globals, lvgl instance, constants, and optional allowed functions list
        // globals can include type specifications: { funcName: { function: fn, params: [...], returnType: type } }
        init: function (globals, lvgl, constants, allowedFunctions) {
            this._interpreter = new Interpreter(globals, lvgl, constants, allowedFunctions);
            this._interpreter.sourceCode = this._sourceCode;
            this._interpreter.execute(this._ast);
            this._allowedFunctions = allowedFunctions;
        },

        // Execute a function by name with arguments
        exec: function (functionName, ...args) {
            if (!this._interpreter) {
                throw new Error('Script not initialized. Call init(globals, lvgl, LVGL_CONSTANTS, allowedFunctions) first.');
            }

            return this._interpreter.callFunction(functionName, args);
        },

        // Generate JavaScript code from EEZ Script AST
        emitJS: function () {
            return emitJS(this._ast, this._allowedFunctions);
        },

        // Generate C code from EEZ Script AST
        emitC: function () {
            return emitC(this._ast, this._allowedFunctions);
        }
    };
}

// Shared type inference - collects type information from AST and decorates nodes
function collectTypeInformation(ast, allowedFunctions) {
    const varTypes = {};

    // Helper to resolve type of an expression and decorate it
    function resolveExpressionType(node, currentFunc = null) {
        if (!node) return null;

        if (node.type === 'Literal') {
            if (typeof node.value === 'number') node.resolvedType = 'number';
            else if (typeof node.value === 'boolean') node.resolvedType = 'bool';
            else if (typeof node.value === 'string') node.resolvedType = 'string';
            return node.resolvedType;
        }

        if (node.type === 'Identifier') {
            const localKey = currentFunc ? `${currentFunc}.${node.name}` : node.name;
            node.resolvedType = varTypes[localKey] || varTypes[node.name] || null;
            return node.resolvedType;
        }

        if (node.type === 'CallExpression' && node.callee.type === 'Identifier') {
            const functionName = node.callee.name;
            if (allowedFunctions && allowedFunctions[functionName]) {
                node.resolvedType = allowedFunctions[functionName].returnType;
            }
            // Resolve types for arguments too
            node.arguments.forEach(arg => resolveExpressionType(arg, currentFunc));
            return node.resolvedType;
        }

        if (node.type === 'BinaryExpression') {
            resolveExpressionType(node.left, currentFunc);
            resolveExpressionType(node.right, currentFunc);
            if (['==', '!=', '<', '>', '<=', '>=', '&&', '||'].includes(node.operator)) {
                node.resolvedType = 'bool';
            } else {
                node.resolvedType = node.left.resolvedType;
            }
            return node.resolvedType;
        }

        if (node.type === 'UnaryExpression') {
            resolveExpressionType(node.argument, currentFunc);
            node.resolvedType = node.argument.resolvedType;
            return node.resolvedType;
        }

        if (node.type === 'AssignmentExpression') {
            resolveExpressionType(node.left, currentFunc);
            resolveExpressionType(node.right, currentFunc);
            node.resolvedType = node.left.resolvedType;
            return node.resolvedType;
        }

        return null;
    }

    // Traverse AST to collect type information and decorate nodes
    function collectTypes(node, currentFunc = null) {
        if (!node) return;

        if (node.type === 'Program') {
            node.body.forEach(stmt => collectTypes(stmt));
        } else if (node.type === 'FunctionDeclaration') {
            if (node.params) {
                node.params.forEach(p => {
                    if (p.type) {
                        varTypes[`${node.name}.${p.name}`] = p.type;
                    }
                });
            }
            collectTypes(node.body, node.name);
        } else if (node.type === 'VariableDeclaration') {
            const key = currentFunc ? `${currentFunc}.${node.name}` : node.name;

            // Use explicit type if provided, otherwise try to infer
            if (node.varType) {
                varTypes[key] = node.varType;
            } else if (node.init) {
                const inferredType = resolveExpressionType(node.init, currentFunc);
                if (inferredType) {
                    varTypes[key] = inferredType;
                }
            }
            node.resolvedType = varTypes[key];
        } else if (node.type === 'BlockStatement') {
            node.body.forEach(stmt => collectTypes(stmt, currentFunc));
        } else if (node.type === 'ExpressionStatement') {
            resolveExpressionType(node.expression, currentFunc);
        } else if (node.type === 'IfStatement') {
            resolveExpressionType(node.test, currentFunc);
            collectTypes(node.consequent, currentFunc);
            collectTypes(node.alternate, currentFunc);
        } else if (node.type === 'ForStatement') {
            if (node.init) {
                if (node.init.type === 'VariableDeclaration') collectTypes(node.init, currentFunc);
                else resolveExpressionType(node.init, currentFunc);
            }
            if (node.test) resolveExpressionType(node.test, currentFunc);
            if (node.update) resolveExpressionType(node.update, currentFunc);
            collectTypes(node.body, currentFunc);
        } else if (node.type === 'WhileStatement') {
            resolveExpressionType(node.test, currentFunc);
            collectTypes(node.body, currentFunc);
        } else if (node.type === 'ReturnStatement') {
            if (node.argument) resolveExpressionType(node.argument, currentFunc);
        }
    }

    collectTypes(ast);
}

// JavaScript code emitter - converts AST to JavaScript code
function emitJS(ast, allowedFunctions) {
    // Collect type information (explicit and inferred) and decorate AST nodes
    collectTypeInformation(ast, allowedFunctions);

    function emit(node, indent = 0, context = {}) {
        const indentStr = '    '.repeat(indent);

        if (!node) return '';

        switch (node.type) {
            case 'Program':
                return node.body.map(stmt => emit(stmt, indent, context)).join('\n');

            case 'FunctionDeclaration':
                const fnParams = node.params.map(p => {
                    // Remove type annotations from parameters
                    return p.name;
                }).join(', ');
                const fnContext = { ...context, currentFunction: node.name };
                const fnBody = emit(node.body, indent, fnContext);
                return `${indentStr}function ${node.name}(${fnParams}) ${fnBody}`;

            case 'VariableDeclaration':
                let varInit = '';
                if (node.init) {
                    const initExpr = emit(node.init, 0, context);
                    // Check if we need to wrap with System.stringToNewUTF8
                    if (node.varType === 'cstring' && node.init.type === 'Literal' && typeof node.init.value === 'string') {
                        varInit = ' = System.stringToNewUTF8(' + initExpr + ')';
                    } else if (node.varType === 'lv_color') {
                        // For lv_color type, use pre-allocated color buffer on lvgl instance
                        // lv_color_hex uses sret: first parameter is pointer to result location
                        if (node.init.type === 'CallExpression' &&
                            node.init.callee.type === 'Identifier' &&
                            node.init.callee.name === 'lv_color_hex') {
                            const colorArg = emit(node.init.arguments[0], 0, context);
                            // Use lvgl instance color buffer (allocated once, reused per lvgl instance)
                            varInit = ` = (() => { if (!lvgl._colorBuffer) lvgl._colorBuffer = lvgl._lv_malloc(4); lvgl._lv_color_hex(lvgl._colorBuffer, ${colorArg}); return lvgl._colorBuffer; })()`;
                        } else {
                            varInit = ' = ' + initExpr;
                        }
                    } else {
                        varInit = ' = ' + initExpr;
                    }
                }
                return `${indentStr}${node.kind} ${node.name}${varInit};`;

            case 'ExpressionStatement':
                return `${indentStr}${emit(node.expression, 0, context)};`;

            case 'BlockStatement':
                const statements = node.body.map(stmt => emit(stmt, indent + 1, context)).join('\n');
                return `{\n${statements}\n${indentStr}}`;

            case 'IfStatement':
                let ifResult = `${indentStr}if (${emit(node.test, 0, context)}) ${emit(node.consequent, indent, context)}`;
                if (node.alternate) {
                    if (node.alternate.type === 'IfStatement') {
                        ifResult += ' else ' + emit(node.alternate, indent, context).trim();
                    } else {
                        ifResult += ' else ' + emit(node.alternate, indent, context);
                    }
                }
                return ifResult;

            case 'ForStatement':
                const forInit = node.init ? emit(node.init, 0, context).trim().replace(/;$/, '') : '';
                const forTest = node.test ? emit(node.test, 0, context) : '';
                const forUpdate = node.update ? emit(node.update, 0, context) : '';
                return `${indentStr}for (${forInit}; ${forTest}; ${forUpdate}) ${emit(node.body, indent, context)}`;

            case 'WhileStatement':
                return `${indentStr}while (${emit(node.test, 0, context)}) ${emit(node.body, indent, context)}`;

            case 'ReturnStatement':
                const retArg = node.argument ? ' ' + emit(node.argument, 0, context) : '';
                return `${indentStr}return${retArg};`;

            case 'BinaryExpression':
                return `${emit(node.left, 0, context)} ${node.operator} ${emit(node.right, 0, context)}`;

            case 'LogicalExpression':
                return `${emit(node.left, 0, context)} ${node.operator} ${emit(node.right, 0, context)}`;

            case 'UnaryExpression':
                return `${node.operator}${emit(node.argument, 0, context)}`;

            case 'UpdateExpression':
                if (node.prefix) {
                    return `${node.operator}${emit(node.argument, 0, context)}`;
                } else {
                    return `${emit(node.argument, 0, context)}${node.operator}`;
                }

            case 'AssignmentExpression':
                return `${emit(node.left, 0, context)} ${node.operator} ${emit(node.right, 0, context)}`;

            case 'CallExpression':
                let calleeName = null;
                let actualFuncName = null;
                let calleePrefix = '';

                // Check if this is an lv_* function call
                if (node.callee.type === 'Identifier' && node.callee.name.startsWith('lv_')) {
                    calleeName = node.callee.name;
                    actualFuncName = calleeName;
                    
                    // Resolve runtimeName (from static_inline) or alias to get the actual WASM function name
                    if (allowedFunctions && allowedFunctions[calleeName]) {
                        if (allowedFunctions[calleeName].runtimeName) {
                            actualFuncName = allowedFunctions[calleeName].runtimeName;
                        } else if (allowedFunctions[calleeName].aliasOf) {
                            actualFuncName = allowedFunctions[calleeName].aliasOf;
                        }
                    }
                    
                    calleePrefix = 'lvgl._';
                }

                // Get function type information if available
                const funcTypeInfo = calleeName && allowedFunctions ? allowedFunctions[calleeName] : null;

                // Check if this function expects cstring parameters (heuristic: contains set_text, set_label, etc.)
                const expectsCString = calleeName && (
                    calleeName.includes('set_text') ||
                    calleeName.includes('set_label') ||
                    calleeName.includes('add_text')
                );

                // Emit arguments with cstring conversion if needed
                const emittedArgs = node.arguments.map((arg, index) => {
                    let argCode = emit(arg, 0, context);
                    let needsConversion = false;
                    let isLvColor = false;

                    // Check function signature for this parameter
                    if (funcTypeInfo && funcTypeInfo.params && funcTypeInfo.params[index]) {
                        const expectedType = funcTypeInfo.params[index];

                        // Check if this parameter expects lv_color
                        if (expectedType === 'lv_color') {
                            isLvColor = true;
                            // If it's already a pointer to lv_color, don't convert
                            if (arg.resolvedType === 'lv_color') {
                                isLvColor = false;
                            }
                        }

                        if (expectedType === 'cstring') {
                            // Check if argument is a string
                            if (arg.resolvedType === 'string') {
                                needsConversion = true;
                            }
                        }
                    }

                    // Check if this is a string literal
                    if (arg.type === 'Literal' && typeof arg.value === 'string') {
                        needsConversion = expectsCString;
                    }
                    // Check if this is an identifier with string type
                    else if (arg.type === 'Identifier') {
                        if (arg.resolvedType === 'string' && expectsCString) {
                            needsConversion = true;
                        }
                    }

                    // Apply lv_color conversion if needed
                    if (isLvColor) {
                        return `(lvgl._colorBuffer || (lvgl._colorBuffer = lvgl._lv_malloc(4)), lvgl._lv_color_hex(lvgl._colorBuffer, ${argCode}), lvgl._colorBuffer)`;
                    }

                    if (needsConversion) {
                        return `System.stringToNewUTF8(${argCode})`;
                    }
                    return argCode;
                });

                const args = emittedArgs.join(', ');

                if (calleePrefix) {
                    // Use actualFuncName (resolved alias) for the actual function call
                    return `${calleePrefix}${actualFuncName}(${args})`;
                } else {
                    return `${emit(node.callee, 0, context)}(${args})`;
                }

            case 'MemberExpression':
                if (node.computed) {
                    return `${emit(node.object, 0, context)}[${emit(node.property, 0, context)}]`;
                } else {
                    // For non-computed access, property is just a string
                    const propName = typeof node.property === 'string' ? node.property : emit(node.property, 0, context);
                    return `${emit(node.object, 0, context)}.${propName}`;
                }

            case 'Identifier':
                // Prefix LVGL constants with lvgl_const.
                if (node.name.startsWith('LV_')) {
                    return `lvgl_const.${node.name}`;
                }
                return node.name;

            case 'Literal':
                if (typeof node.value === 'string') {
                    return `"${node.value.replace(/"/g, '\\"')}"`;
                }
                return String(node.value);

            default:
                throw new Error(`Unknown node type in emit: ${node.type}`);
        }
    }

    return emit(ast);
}

// C code emitter - converts AST to C code
function emitC(ast, allowedFunctions) {
    // Collect type information (explicit and inferred) and decorate AST nodes
    collectTypeInformation(ast, allowedFunctions);

    function mapTypeToCType(type) {
        if (!type) return 'void';
        switch (type) {
            case 'number': return 'int32_t';
            case 'bool': return 'bool';
            case 'string': return 'const char*';
            case 'cstring': return 'const char*';
            case 'lv_obj': return 'lv_obj_t*';
            case 'lv_color': return 'lv_color_t';
            case 'function': return 'lv_event_cb_t';
            default:
                // Custom types like lv_obj
                if (type.startsWith('lv_')) {
                    return type + '_t*';
                }
                return type;
        }
    }

    function emit(node, indent = 0, context = {}) {
        const indentStr = '    '.repeat(indent);

        if (!node) return '';

        switch (node.type) {
            case 'Program':
                return node.body.map(stmt => emit(stmt, indent, context)).join('\n\n');

            case 'FunctionDeclaration':
                const returnType = mapTypeToCType(node.returnType);
                const params = node.params.map(p => {
                    let paramType = mapTypeToCType(p.type);
                    // Event callbacks receive lv_event_t* instead of int32_t
                    if (p.type === 'number' && node.params.length === 1) {
                        // Single number parameter likely means event callback
                        paramType = 'lv_event_t*';
                    }
                    return `${paramType} ${p.name}`;
                }).join(', ');
                const fnContext = { ...context, currentFunction: node.name };
                const fnBody = emit(node.body, indent, fnContext);
                return `${indentStr}${returnType} ${node.name}(${params}) ${fnBody}`;

            case 'VariableDeclaration':
                // Get type from collected types (either explicit or inferred)
                const varType = mapTypeToCType(node.varType || node.resolvedType);
                let varInit = '';
                if (node.init) {
                    varInit = ' = ' + emit(node.init, 0, context);
                }
                return `${indentStr}${varType} ${node.name}${varInit};`;

            case 'ExpressionStatement':
                // Check if this is a call with string concatenation that needs preprocessing
                let preamble = '';

                if (node.expression.type === 'CallExpression') {
                    const callNode = node.expression;

                    // Check each argument for string concatenation
                    callNode.arguments.forEach((arg, index) => {
                        if (arg.type === 'BinaryExpression' && arg.operator === '+') {
                            const parts = [];

                            function collectParts(n) {
                                if (n.type === 'BinaryExpression' && n.operator === '+') {
                                    collectParts(n.left);
                                    collectParts(n.right);
                                } else {
                                    parts.push(n);
                                }
                            }

                            collectParts(arg);

                            const hasStringLiteral = parts.some(p =>
                                p.type === 'Literal' && typeof p.value === 'string'
                            );

                            if (hasStringLiteral && parts.length > 1) {
                                // Generate format string and args
                                let formatStr = '';
                                const sprintfArgs = [];

                                parts.forEach(part => {
                                    if (part.type === 'Literal' && typeof part.value === 'string') {
                                        formatStr += part.value;
                                    } else {
                                        const partType = part.resolvedType;

                                        if (partType === 'number' || !partType) {
                                            formatStr += '%d';
                                        } else if (partType === 'string' || partType === 'cstring') {
                                            formatStr += '%s';
                                        } else {
                                            formatStr += '%d';
                                        }

                                        sprintfArgs.push(emit(part, 0, context));
                                    }
                                });

                                const bufferName = `_str_buf`;
                                const argsStr = sprintfArgs.length > 0 ? ', ' + sprintfArgs.join(', ') : '';

                                // Store buffer info in context for CallExpression to use
                                if (!context.stringBuffers) {
                                    context.stringBuffers = new Map();
                                }
                                context.stringBuffers.set(arg, bufferName);

                                preamble += `${indentStr}static char ${bufferName}[256];\n`;
                                preamble += `${indentStr}snprintf(${bufferName}, sizeof(${bufferName}), "${formatStr}"${argsStr});\n`;
                            }
                        }
                    });
                }

                return preamble + `${indentStr}${emit(node.expression, 0, context)};`;

            case 'BlockStatement':
                const statements = node.body.map(stmt => emit(stmt, indent + 1, context)).join('\n');
                return `{\n${statements}\n${indentStr}}`;

            case 'IfStatement':
                let ifResult = `${indentStr}if (${emit(node.test, 0, context)}) ${emit(node.consequent, indent, context)}`;
                if (node.alternate) {
                    if (node.alternate.type === 'IfStatement') {
                        ifResult += ' else ' + emit(node.alternate, indent, context).trim();
                    } else {
                        ifResult += ' else ' + emit(node.alternate, indent, context);
                    }
                }
                return ifResult;

            case 'ForStatement':
                const forInit = node.init ? emit(node.init, 0, context).trim().replace(/;$/, '') : '';
                const forTest = node.test ? emit(node.test, 0, context) : '';
                const forUpdate = node.update ? emit(node.update, 0, context) : '';
                return `${indentStr}for (${forInit}; ${forTest}; ${forUpdate}) ${emit(node.body, indent, context)}`;

            case 'WhileStatement':
                return `${indentStr}while (${emit(node.test, 0, context)}) ${emit(node.body, indent, context)}`;

            case 'ReturnStatement':
                const retArg = node.argument ? ' ' + emit(node.argument, 0, context) : '';
                return `${indentStr}return${retArg};`;

            case 'BinaryExpression':
                // Check if this node has already been processed into a string buffer
                if (context.stringBuffers && context.stringBuffers.has(node)) {
                    return context.stringBuffers.get(node);
                }

                // Handle logical operators - map to C equivalents
                let op = node.operator;
                if (op === '&&') op = '&&';
                if (op === '||') op = '||';

                // For + operator with string concatenation, it should have been
                // handled in ExpressionStatement. If we reach here, emit as-is
                return `${emit(node.left, 0, context)} ${op} ${emit(node.right, 0, context)}`;

            case 'LogicalExpression':
                return `${emit(node.left, 0, context)} ${node.operator} ${emit(node.right, 0, context)}`;

            case 'UnaryExpression':
                return `${node.operator}${emit(node.argument, 0, context)}`;

            case 'UpdateExpression':
                if (node.prefix) {
                    return `${node.operator}${emit(node.argument, 0, context)}`;
                } else {
                    return `${emit(node.argument, 0, context)}${node.operator}`;
                }

            case 'AssignmentExpression':
                return `${emit(node.left, 0, context)} ${node.operator} ${emit(node.right, 0, context)}`;

            case 'CallExpression':
                let calleeName = null;

                // Check if this is an lv_* function call
                if (node.callee.type === 'Identifier' && node.callee.name.startsWith('lv_')) {
                    calleeName = node.callee.name;
                }

                // Get function type information if available
                const funcTypeInfo = calleeName && allowedFunctions ? allowedFunctions[calleeName] : null;

                // Emit arguments with special handling
                const emittedArgs = node.arguments.map((arg, index) => {
                    // Check if this argument has a pre-generated buffer in context
                    if (context.stringBuffers && context.stringBuffers.has(arg)) {
                        return context.stringBuffers.get(arg);
                    }

                    let argCode = emit(arg, 0, context);

                    // Check if this parameter expects lv_color
                    if (funcTypeInfo && funcTypeInfo.params && funcTypeInfo.params[index]) {
                        const expectedType = funcTypeInfo.params[index];

                        if (expectedType === 'lv_color') {
                            // If it's already a pointer to lv_color, don't convert
                            if (arg.resolvedType === 'lv_color') {
                                return argCode;
                            }
                            // Wrap with lv_color_hex
                            return `lv_color_hex(${argCode})`;
                        }
                    }

                    return argCode;
                });

                const args = emittedArgs.join(', ');

                if (calleeName) {
                    return `${calleeName}(${args})`;
                } else {
                    return `${emit(node.callee, 0, context)}(${args})`;
                }

            case 'MemberExpression':
                if (node.computed) {
                    return `${emit(node.object, 0, context)}[${emit(node.property, 0, context)}]`;
                } else {
                    const propName = typeof node.property === 'string' ? node.property : emit(node.property, 0, context);
                    return `${emit(node.object, 0, context)}.${propName}`;
                }

            case 'Identifier':
                // LVGL constants are used directly in C
                return node.name;

            case 'Literal':
                if (typeof node.value === 'string') {
                    return `"${node.value.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
                }
                if (typeof node.value === 'boolean') {
                    return node.value ? 'true' : 'false';
                }
                if (node.value === null) {
                    return 'NULL';
                }
                return String(node.value);

            default:
                throw new Error(`Unknown node type in emit: ${node.type}`);
        }
    }

    return emit(ast);
}

// Export for use in browser or Node.js
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = {
        eez_script_compile,
        eez_script_version,
        eez_script_validate,
        Lexer,
        Parser,
        Interpreter
    };
}
