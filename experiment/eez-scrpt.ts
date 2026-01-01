/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * EEZ Script - A JavaScript-like scripting language
 *
 * TypeScript port of `src/eez-script.js` with strict-friendly types.
 */

// ---------------------------------------------------------------------------
// Minimal globals for Node-style exports without requiring @types/node
// ---------------------------------------------------------------------------

declare const module: { exports?: unknown } | undefined;

// ---------------------------------------------------------------------------
// AST + Token Types
// ---------------------------------------------------------------------------

type EezTypeName =
    | 'number'
    | 'bool'
    | 'string'
    | 'cstring'
    | 'lv_color'
    | 'function'
    | 'lv_obj'
    | string;

interface SourceLocation {
    line: number;
    column: number;
}

interface ASTNode {
    type: string;
    loc?: SourceLocation;
}

interface Program extends ASTNode {
    type: 'Program';
    body: Statement[];
}

interface BlockStatement extends ASTNode {
    type: 'BlockStatement';
    body: Statement[];
}

interface ExpressionStatement extends ASTNode {
    type: 'ExpressionStatement';
    expression: Expression;
}

interface ReturnStatement extends ASTNode {
    type: 'ReturnStatement';
    argument: Expression | null;
}

interface IfStatement extends ASTNode {
    type: 'IfStatement';
    test: Expression;
    consequent: Statement;
    alternate: Statement | null;
}

interface ForStatement extends ASTNode {
    type: 'ForStatement';
    init: VariableDeclaration | Expression | null;
    test: Expression | null;
    update: Expression | null;
    body: Statement;
}

interface WhileStatement extends ASTNode {
    type: 'WhileStatement';
    test: Expression;
    body: Statement;
}

interface FunctionParam {
    name: string;
    type: EezTypeName | null;
}

interface FunctionDeclaration extends ASTNode {
    type: 'FunctionDeclaration';
    name: string;
    params: FunctionParam[];
    returnType: EezTypeName | null;
    body: BlockStatement;
}

interface VariableDeclaration extends ASTNode {
    type: 'VariableDeclaration';
    kind: 'let' | 'const';
    name: string;
    varType: EezTypeName | null;
    init: Expression | null;
}

interface Identifier extends ASTNode {
    type: 'Identifier';
    name: string;
}

interface Literal extends ASTNode {
    type: 'Literal';
    value: number | string | boolean | null | undefined;
}

interface BinaryExpression extends ASTNode {
    type: 'BinaryExpression';
    operator: string;
    left: Expression;
    right: Expression;
}

interface UnaryExpression extends ASTNode {
    type: 'UnaryExpression';
    operator: string;
    argument: Expression;
    prefix?: boolean;
}

interface UpdateExpression extends ASTNode {
    type: 'UpdateExpression';
    operator: string;
    prefix: boolean;
    argument: Expression;
}

interface AssignmentExpression extends ASTNode {
    type: 'AssignmentExpression';
    operator: string;
    left: Expression;
    right: Expression;
}

interface CallExpression extends ASTNode {
    type: 'CallExpression';
    callee: Expression;
    arguments: Expression[];
}

interface MemberExpression extends ASTNode {
    type: 'MemberExpression';
    object: Expression;
    property: Expression | string;
    computed: boolean;
}

type Expression =
    | Literal
    | Identifier
    | BinaryExpression
    | UnaryExpression
    | UpdateExpression
    | AssignmentExpression
    | CallExpression
    | MemberExpression;

type Statement =
    | FunctionDeclaration
    | VariableDeclaration
    | ExpressionStatement
    | BlockStatement
    | IfStatement
    | ForStatement
    | WhileStatement
    | ReturnStatement;

type TokenType = string;

interface Token {
    type: TokenType;
    value?: any;
}

// ---------------------------------------------------------------------------
// LVGL/Runtime Types (minimal)
// ---------------------------------------------------------------------------

type Globals = Record<string, any>;

type LVGLConstants = Record<string, number>;

type LVGLInstance = Record<string, any>;

interface FunctionTypeSpec {
    params: string[];
    returnType?: string;
}

type AllowedFunctions =
    | string[]
    | Record<string, number | { min?: number; max?: number } | FunctionTypeSpec>;

// ---------------------------------------------------------------------------
// LEXER (Tokenizer)
// ---------------------------------------------------------------------------

class Lexer {
    private input: string;
    private pos: number;
    private line: number;
    private column: number;

    constructor(input: string) {
        this.input = input;
        this.pos = 0;
        this.line = 1;
        this.column = 1;
    }

    private peek(): string {
        return this.input[this.pos];
    }

    private advance(): string {
        const ch = this.input[this.pos++];
        if (ch === '\n') {
            this.line++;
            this.column = 1;
        } else {
            this.column++;
        }
        return ch;
    }

    private skipWhitespace(): void {
        while (this.pos < this.input.length && /\s/.test(this.peek())) {
            this.advance();
        }
    }

    private skipLineComment(): void {
        while (this.pos < this.input.length && this.peek() !== '\n') {
            this.advance();
        }
    }

    private skipBlockComment(): void {
        this.advance(); // skip '*'
        while (this.pos < this.input.length) {
            if (this.peek() === '*' && this.input[this.pos + 1] === '/') {
                this.advance(); // skip '*'
                this.advance(); // skip '/'
                break;
            }
            this.advance();
        }
    }

    private readNumber(): Token {
        let num = '';

        // Check for hexadecimal (0x or 0X prefix)
        if (
            this.peek() === '0' &&
            (this.input[this.pos + 1] === 'x' || this.input[this.pos + 1] === 'X')
        ) {
            num += this.advance(); // '0'
            num += this.advance(); // 'x' or 'X'
            while (this.pos < this.input.length && /[0-9a-fA-F]/.test(this.peek())) {
                num += this.advance();
            }
            return { type: 'NUMBER', value: parseInt(num, 16) };
        }

        // Regular decimal number
        while (this.pos < this.input.length && /[0-9.]/.test(this.peek())) {
            num += this.advance();
        }
        return { type: 'NUMBER', value: parseFloat(num) };
    }

    private readString(quote: string): Token {
        this.advance(); // skip opening quote
        let str = '';
        while (this.pos < this.input.length && this.peek() !== quote) {
            if (this.peek() === '\\') {
                this.advance();
                const next = this.advance();
                switch (next) {
                    case 'n':
                        str += '\n';
                        break;
                    case 't':
                        str += '\t';
                        break;
                    case 'r':
                        str += '\r';
                        break;
                    case '\\':
                        str += '\\';
                        break;
                    case '"':
                        str += '"';
                        break;
                    case "'":
                        str += "'";
                        break;
                    default:
                        str += next;
                }
            } else {
                str += this.advance();
            }
        }
        this.advance(); // skip closing quote
        return { type: 'STRING', value: str };
    }

    private readIdentifier(): Token {
        let id = '';
        while (this.pos < this.input.length && /[a-zA-Z0-9_]/.test(this.peek())) {
            id += this.advance();
        }

        // Check for keywords
        const keywords: Record<string, string> = {
            function: 'FUNCTION',
            return: 'RETURN',
            if: 'IF',
            else: 'ELSE',
            for: 'FOR',
            while: 'WHILE',
            let: 'LET',
            const: 'CONST',
            true: 'TRUE',
            false: 'FALSE',
            null: 'NULL',
            undefined: 'UNDEFINED',
            number: 'TYPE_NUMBER',
            bool: 'TYPE_BOOL',
            string: 'TYPE_STRING',
            cstring: 'TYPE_CSTRING',
            lv_color: 'TYPE_LV_COLOR'
        };

        return { type: keywords[id] || 'IDENTIFIER', value: id };
    }

    private nextToken(): Token {
        this.skipWhitespace();

        if (this.pos >= this.input.length) {
            return { type: 'EOF' };
        }

        const ch = this.peek();

        // Comments
        if (ch === '/' && this.input[this.pos + 1] === '/') {
            this.skipLineComment();
            return this.nextToken();
        }

        if (ch === '/' && this.input[this.pos + 1] === '*') {
            this.advance(); // skip '/'
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
            return { type: doubleChar, value: doubleChar };
        }

        const singleChar: Record<string, string> = {
            '(': 'LPAREN',
            ')': 'RPAREN',
            '{': 'LBRACE',
            '}': 'RBRACE',
            '[': 'LBRACKET',
            ']': 'RBRACKET',
            ';': 'SEMICOLON',
            ',': 'COMMA',
            '.': 'DOT',
            ':': 'COLON',
            '=': 'ASSIGN',
            '+': 'PLUS',
            '-': 'MINUS',
            '*': 'STAR',
            '/': 'SLASH',
            '%': 'PERCENT',
            '<': 'LT',
            '>': 'GT',
            '!': 'NOT',
            '&': 'AMP',
            '|': 'PIPE',
            '^': 'CARET'
        };

        if (singleChar[ch]) {
            this.advance();
            return { type: singleChar[ch], value: ch };
        }

        throw new Error(`Unexpected character '${ch}' at line ${this.line}:${this.column}`);
    }

    tokenize(): Token[] {
        const tokens: Token[] = [];
        let token: Token;
        // eslint-disable-next-line no-constant-condition
        while (true) {
            token = this.nextToken();
            if (token.type === 'EOF') break;
            tokens.push(token);
        }
        tokens.push(token); // Add EOF
        return tokens;
    }
}

// ---------------------------------------------------------------------------
// PARSER (AST Builder)
// ---------------------------------------------------------------------------

class Parser {
    private tokens: Token[];
    private pos: number;

    constructor(tokens: Token[]) {
        this.tokens = tokens;
        this.pos = 0;
    }

    private peek(): Token {
        return this.tokens[this.pos];
    }

    private advance(): Token {
        return this.tokens[this.pos++];
    }

    private expect(type: TokenType): Token {
        const token = this.advance();
        if (token.type !== type) {
            throw new Error(`Expected ${type} but got ${token.type}`);
        }
        return token;
    }

    // Program = Statement*
    parseProgram(): Program {
        const statements: Statement[] = [];
        while (this.peek().type !== 'EOF') {
            statements.push(this.parseStatement());
        }
        return { type: 'Program', body: statements };
    }

    // Statement = FunctionDeclaration | IfStatement | ForStatement | WhileStatement | ReturnStatement | ExpressionStatement
    private parseStatement(): Statement {
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
    private parseFunctionDeclaration(): FunctionDeclaration {
        this.expect('FUNCTION');
        const name = String(this.expect('IDENTIFIER').value);
        this.expect('LPAREN');

        const params: FunctionParam[] = [];
        if (this.peek().type !== 'RPAREN') {
            // Parse parameter with optional type annotation
            const paramName = String(this.expect('IDENTIFIER').value);
            let paramType: EezTypeName | null = null;
            if (this.peek().type === 'COLON') {
                this.advance(); // skip ':'
                paramType = this.parseType();
            }
            params.push({ name: paramName, type: paramType });

            while (this.peek().type === 'COMMA') {
                this.advance();
                const pName = String(this.expect('IDENTIFIER').value);
                let pType: EezTypeName | null = null;
                if (this.peek().type === 'COLON') {
                    this.advance();
                    pType = this.parseType();
                }
                params.push({ name: pName, type: pType });
            }
        }

        this.expect('RPAREN');

        // Parse optional return type
        let returnType: EezTypeName | null = null;
        if (this.peek().type === 'COLON') {
            this.advance();
            returnType = this.parseType();
        }

        const body = this.parseBlockStatement();

        return { type: 'FunctionDeclaration', name, params, returnType, body };
    }

    // Type = 'number' | 'bool' | 'string' | 'cstring' | 'lv_color' | Identifier
    private parseType(): EezTypeName {
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
            return String(token.value); // Custom type like lv_obj
        }
        throw new Error(`Expected type but got ${token.type}`);
    }

    // BlockStatement = '{' Statement* '}'
    private parseBlockStatement(): BlockStatement {
        this.expect('LBRACE');
        const statements: Statement[] = [];
        while (this.peek().type !== 'RBRACE') {
            statements.push(this.parseStatement());
        }
        this.expect('RBRACE');
        return { type: 'BlockStatement', body: statements };
    }

    // VariableDeclaration = ('let' | 'const') Identifier (':' Type)? ('=' Expression)? ';'
    private parseVariableDeclaration(): VariableDeclaration {
        const kindToken = this.advance().type; // LET or CONST
        const name = String(this.expect('IDENTIFIER').value);
        let varType: EezTypeName | null = null;
        let init: Expression | null = null;

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

        return {
            type: 'VariableDeclaration',
            kind: kindToken.toLowerCase() as 'let' | 'const',
            name,
            varType,
            init
        };
    }

    // IfStatement = 'if' '(' Expression ')' Statement ('else' Statement)?
    private parseIfStatement(): IfStatement {
        this.expect('IF');
        this.expect('LPAREN');
        const test = this.parseExpression();
        this.expect('RPAREN');
        const consequent = this.parseStatement();
        let alternate: Statement | null = null;

        if (this.peek().type === 'ELSE') {
            this.advance();
            alternate = this.parseStatement();
        }

        return { type: 'IfStatement', test, consequent, alternate };
    }

    // ForStatement = 'for' '(' (VariableDeclaration | ExpressionStatement) Expression ';' Expression ')' Statement
    private parseForStatement(): ForStatement {
        this.expect('FOR');
        this.expect('LPAREN');

        let init: VariableDeclaration | Expression | null = null;
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
    private parseWhileStatement(): WhileStatement {
        this.expect('WHILE');
        this.expect('LPAREN');
        const test = this.parseExpression();
        this.expect('RPAREN');
        const body = this.parseStatement();

        return { type: 'WhileStatement', test, body };
    }

    // ReturnStatement = 'return' Expression? ';'
    private parseReturnStatement(): ReturnStatement {
        this.expect('RETURN');
        let argument: Expression | null = null;

        if (this.peek().type !== 'SEMICOLON' && this.peek().type !== 'RBRACE') {
            argument = this.parseExpression();
        }

        if (this.peek().type === 'SEMICOLON') {
            this.advance();
        }

        return { type: 'ReturnStatement', argument };
    }

    // ExpressionStatement = Expression ';'
    private parseExpressionStatement(): ExpressionStatement {
        const expr = this.parseExpression();
        if (this.peek().type === 'SEMICOLON') {
            this.advance();
        }
        return { type: 'ExpressionStatement', expression: expr };
    }

    // Expression = AssignmentExpression
    private parseExpression(): Expression {
        return this.parseAssignmentExpression();
    }

    // AssignmentExpression = LogicalOrExpression (('=' | '+=' | '-=' | '*=' | '/=') AssignmentExpression)?
    private parseAssignmentExpression(): Expression {
        const left = this.parseLogicalOrExpression();

        if (['ASSIGN', '+=', '-=', '*=', '/='].includes(this.peek().type)) {
            const operator = String(this.advance().value);
            const right = this.parseAssignmentExpression();
            return { type: 'AssignmentExpression', operator, left, right };
        }

        return left;
    }

    // LogicalOrExpression = LogicalAndExpression ('||' LogicalAndExpression)*
    private parseLogicalOrExpression(): Expression {
        let left = this.parseLogicalAndExpression();

        while (this.peek().type === '||') {
            const operator = String(this.advance().value);
            const right = this.parseLogicalAndExpression();
            left = { type: 'BinaryExpression', operator, left, right };
        }

        return left;
    }

    // LogicalAndExpression = BitwiseOrExpression ('&&' BitwiseOrExpression)*
    private parseLogicalAndExpression(): Expression {
        let left = this.parseBitwiseOrExpression();

        while (this.peek().type === '&&') {
            const operator = String(this.advance().value);
            const right = this.parseBitwiseOrExpression();
            left = { type: 'BinaryExpression', operator, left, right };
        }

        return left;
    }

    // BitwiseOrExpression = BitwiseXorExpression ('|' BitwiseXorExpression)*
    private parseBitwiseOrExpression(): Expression {
        let left = this.parseBitwiseXorExpression();

        while (this.peek().type === 'PIPE') {
            const operator = String(this.advance().value);
            const right = this.parseBitwiseXorExpression();
            left = { type: 'BinaryExpression', operator, left, right };
        }

        return left;
    }

    // BitwiseXorExpression = BitwiseAndExpression ('^' BitwiseAndExpression)*
    private parseBitwiseXorExpression(): Expression {
        let left = this.parseBitwiseAndExpression();

        while (this.peek().type === 'CARET') {
            const operator = String(this.advance().value);
            const right = this.parseBitwiseAndExpression();
            left = { type: 'BinaryExpression', operator, left, right };
        }

        return left;
    }

    // BitwiseAndExpression = EqualityExpression ('&' EqualityExpression)*
    private parseBitwiseAndExpression(): Expression {
        let left = this.parseEqualityExpression();

        while (this.peek().type === 'AMP') {
            const operator = String(this.advance().value);
            const right = this.parseEqualityExpression();
            left = { type: 'BinaryExpression', operator, left, right };
        }

        return left;
    }

    // EqualityExpression = RelationalExpression (('==' | '!=') RelationalExpression)*
    private parseEqualityExpression(): Expression {
        let left = this.parseRelationalExpression();

        while (['==', '!='].includes(this.peek().type)) {
            const operator = String(this.advance().value);
            const right = this.parseRelationalExpression();
            left = { type: 'BinaryExpression', operator, left, right };
        }

        return left;
    }

    // RelationalExpression = AdditiveExpression (('<' | '>' | '<=' | '>=') AdditiveExpression)*
    private parseRelationalExpression(): Expression {
        let left = this.parseAdditiveExpression();

        while (['LT', 'GT', '<=', '>='].includes(this.peek().type)) {
            const operator = String(this.advance().value);
            const right = this.parseAdditiveExpression();
            left = { type: 'BinaryExpression', operator, left, right };
        }

        return left;
    }

    // AdditiveExpression = MultiplicativeExpression (('+' | '-') MultiplicativeExpression)*
    private parseAdditiveExpression(): Expression {
        let left = this.parseMultiplicativeExpression();

        while (['PLUS', 'MINUS'].includes(this.peek().type)) {
            const operator = String(this.advance().value);
            const right = this.parseMultiplicativeExpression();
            left = { type: 'BinaryExpression', operator, left, right };
        }

        return left;
    }

    // MultiplicativeExpression = UnaryExpression (('*' | '/' | '%') UnaryExpression)*
    private parseMultiplicativeExpression(): Expression {
        let left = this.parseUnaryExpression();

        while (['STAR', 'SLASH', 'PERCENT'].includes(this.peek().type)) {
            const operator = String(this.advance().value);
            const right = this.parseUnaryExpression();
            left = { type: 'BinaryExpression', operator, left, right };
        }

        return left;
    }

    // UnaryExpression = ('!' | '-' | '++' | '--') UnaryExpression | PostfixExpression
    private parseUnaryExpression(): Expression {
        if (['NOT', 'MINUS', '++', '--'].includes(this.peek().type)) {
            const operator = String(this.advance().value);
            const argument = this.parseUnaryExpression();
            return { type: 'UnaryExpression', operator, prefix: true, argument };
        }

        return this.parsePostfixExpression();
    }

    // PostfixExpression = PrimaryExpression ('(' Arguments? ')' | '.' Identifier | '[' Expression ']' | '++' | '--')*
    private parsePostfixExpression(): Expression {
        let expr = this.parsePrimaryExpression();

        while (true) {
            const token = this.peek();

            if (token.type === 'LPAREN') {
                // Function call
                this.advance();
                const args: Expression[] = [];
                if (this.peek().type !== 'RPAREN') {
                    args.push(this.parseExpression());
                    while (this.peek().type === 'COMMA') {
                        this.advance();
                        args.push(this.parseExpression());
                    }
                }
                this.expect('RPAREN');
                expr = { type: 'CallExpression', callee: expr, arguments: args };
            } else if (token.type === 'DOT') {
                // Member access
                this.advance();
                const property = String(this.expect('IDENTIFIER').value);
                expr = { type: 'MemberExpression', object: expr, property, computed: false };
            } else if (token.type === 'LBRACKET') {
                // Computed member access
                this.advance();
                const property = this.parseExpression();
                this.expect('RBRACKET');
                expr = { type: 'MemberExpression', object: expr, property, computed: true };
            } else if (token.type === '++' || token.type === '--') {
                const operator = String(this.advance().value);
                expr = { type: 'UpdateExpression', operator, prefix: false, argument: expr };
            } else {
                break;
            }
        }

        return expr;
    }

    // PrimaryExpression = Identifier | Literal | '(' Expression ')'
    private parsePrimaryExpression(): Expression {
        const token = this.peek();

        if (token.type === 'IDENTIFIER') {
            return { type: 'Identifier', name: String(this.advance().value) };
        }

        if (token.type === 'NUMBER') {
            return { type: 'Literal', value: this.advance().value };
        }

        if (token.type === 'STRING') {
            return { type: 'Literal', value: this.advance().value };
        }

        if (token.type === 'TRUE') {
            this.advance();
            return { type: 'Literal', value: true };
        }

        if (token.type === 'FALSE') {
            this.advance();
            return { type: 'Literal', value: false };
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

        throw new Error(`Unexpected token ${token.type}`);
    }
}

// ---------------------------------------------------------------------------
// INTERPRETER (AST Evaluator)
// ---------------------------------------------------------------------------

type Scope = Record<string, any>;

type ReturnValue = { __return: true; value: any };

type VariableTypes = Record<string, string | { params: string[]; returnType?: string }>;

type FunctionTypes = Record<string, FunctionTypeSpec>;

type GlobalFunctionTypes = Record<string, FunctionTypeSpec>;

class Interpreter {
    private globalFunctionTypes: GlobalFunctionTypes;
    private globals: Globals;
    private lvgl: LVGLInstance;
    private constants: LVGLConstants;
    private allowedFunctions: string[] | null;
    private functionArgCounts: Record<string, number | { min?: number; max?: number }>;
    private functionTypes: FunctionTypes;
    private globalScope: Scope;
    private functions: Record<string, FunctionDeclaration>;
    private variableTypes: VariableTypes;
    public sourceCode: string;
    private currentNode: ASTNode | null;
    private _colorBuffer: any;
    private eventManager: any;

    constructor(globals: Globals, lvgl: LVGLInstance, constants: LVGLConstants, allowedFunctions?: AllowedFunctions) {
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
                        this.functionArgCounts[funcName] = spec as number | { min?: number; max?: number };
                    } else if (typeof spec === 'object' && spec && 'params' in spec) {
                        // New format: full type info
                        this.functionTypes[funcName] = spec as FunctionTypeSpec;
                        this.functionArgCounts[funcName] = (spec as FunctionTypeSpec).params.length;
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
    private processGlobalsObject(obj: any, pathPrefix: string): Globals {
        if (!obj) return {};

        const result: Globals = {};
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
    private getMemberExpressionPath(node: Expression): string | null {
        if (node.type === 'Identifier') {
            return (node as Identifier).name;
        } else if (node.type === 'MemberExpression' && !(node as MemberExpression).computed) {
            const member = node as MemberExpression;
            const objectPath = this.getMemberExpressionPath(member.object);
            return objectPath ? `${objectPath}.${String(member.property)}` : null;
        }
        return null;
    }

    // Control flow exception for return statements
    private createReturnValue(value: any): ReturnValue {
        return { __return: true, value };
    }

    private isReturnValue(value: any): value is ReturnValue {
        return !!value && value.__return === true;
    }

    private createRuntimeError(message: string, node: ASTNode | null = null): Error {
        const errorNode = node || this.currentNode;
        let errorMsg = message;

        // Add source context if available
        if (this.sourceCode && errorNode && errorNode.loc) {
            const lines = this.sourceCode.split('\n');
            const line = errorNode.loc.line - 1;
            const col = errorNode.loc.column;

            errorMsg += `\n\nAt line ${errorNode.loc.line}, column ${col + 1}:`;

            // Show the line with the error
            if (line >= 0 && line < lines.length) {
                errorMsg += `\n${lines[line]}`;
                errorMsg += `\n${' '.repeat(col)}^`;
            }
        }

        return new Error(errorMsg);
    }

    execute(ast: Program): void {
        this.visitProgram(ast);
    }

    private visitProgram(node: Program): void {
        for (const statement of node.body) {
            this.visitStatement(statement, this.globalScope);
        }
    }

    private visitStatement(node: Statement, scope: Scope): any {
        switch (node.type) {
            case 'FunctionDeclaration':
                return this.visitFunctionDeclaration(node as FunctionDeclaration, scope);
            case 'VariableDeclaration':
                return this.visitVariableDeclaration(node as VariableDeclaration, scope);
            case 'ExpressionStatement':
                return this.visitExpressionStatement(node as ExpressionStatement, scope);
            case 'BlockStatement':
                return this.visitBlockStatement(node as BlockStatement, scope);
            case 'IfStatement':
                return this.visitIfStatement(node as IfStatement, scope);
            case 'ForStatement':
                return this.visitForStatement(node as ForStatement, scope);
            case 'WhileStatement':
                return this.visitWhileStatement(node as WhileStatement, scope);
            case 'ReturnStatement':
                return this.visitReturnStatement(node as ReturnStatement, scope);
            default:
                throw new Error(`Unknown statement type: ${(node as any).type}`);
        }
    }

    private visitFunctionDeclaration(node: FunctionDeclaration, scope: Scope): void {
        this.functions[node.name] = node;
        scope[node.name] = (...args: any[]) => this.callFunction(node.name, args);

        // Store parameter types for this function
        if (node.params && node.params.length > 0 && node.params[0].type) {
            this.variableTypes[node.name] = {
                params: node.params.map(p => String(p.type)),
                returnType: node.returnType ? String(node.returnType) : undefined
            };
        }
    }

    private visitVariableDeclaration(node: VariableDeclaration, scope: Scope): void {
        let value: any = node.init ? this.visitExpression(node.init, scope) : undefined;

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
            this.variableTypes[node.name] = String(node.varType);
        }
    }

    private getValueType(value: any): string {
        // Note: cstring is stored as a number (pointer), so we can't distinguish it from number at runtime
        // Type checking for cstring happens at assignment/call time
        if (typeof value === 'number') return 'number';
        if (typeof value === 'boolean') return 'bool';
        if (typeof value === 'string') return 'string';
        if (typeof value === 'function') return 'function';
        if (value === null) return 'null';
        if (value === undefined) return 'undefined';
        // Check if it's an LVGL object (represented as object with type property)
        if (typeof value === 'object' && value !== null && (value as any).type) {
            // Map object types to lv_obj compatible types
            if ((value as any).type === 'obj' || (value as any).type === 'button' || (value as any).type === 'label') {
                return 'lv_obj';
            }
            return String((value as any).type);
        }
        return 'unknown';
    }

    private isTypeCompatible(actualType: string, expectedType: string): boolean {
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

    private convertStringToCString(value: string): any {
        // Convert JavaScript string to C string using System.stringToNewUTF8
        if (!this.globals.System || !this.globals.System.stringToNewUTF8) {
            throw new Error('System.stringToNewUTF8 is required for cstring conversion but is not available');
        }
        return this.globals.System.stringToNewUTF8(value);
    }

    private visitExpressionStatement(node: ExpressionStatement, scope: Scope): any {
        return this.visitExpression(node.expression, scope);
    }

    private visitBlockStatement(node: BlockStatement, scope: Scope): any {
        const blockScope: Scope = Object.create(scope);

        for (const statement of node.body) {
            const result = this.visitStatement(statement, blockScope);
            if (this.isReturnValue(result)) {
                return result;
            }
        }
    }

    private visitIfStatement(node: IfStatement, scope: Scope): any {
        const test = this.visitExpression(node.test, scope);
        if (test) {
            return this.visitStatement(node.consequent, scope);
        } else if (node.alternate) {
            return this.visitStatement(node.alternate, scope);
        }
    }

    private visitForStatement(node: ForStatement, scope: Scope): any {
        const forScope: Scope = Object.create(scope);

        if (node.init) {
            if ((node.init as any).type === 'VariableDeclaration') {
                this.visitStatement(node.init as any, forScope);
            } else {
                this.visitExpression(node.init as Expression, forScope);
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

    private visitWhileStatement(node: WhileStatement, scope: Scope): any {
        while (true) {
            const test = this.visitExpression(node.test, scope);
            if (!test) break;

            const result = this.visitStatement(node.body, scope);
            if (this.isReturnValue(result)) {
                return result;
            }
        }
    }

    private visitReturnStatement(node: ReturnStatement, scope: Scope): ReturnValue {
        const value = node.argument ? this.visitExpression(node.argument, scope) : undefined;
        return this.createReturnValue(value);
    }

    private visitExpression(node: Expression, scope: Scope): any {
        switch (node.type) {
            case 'Literal':
                return (node as Literal).value;
            case 'Identifier':
                return this.visitIdentifier(node as Identifier, scope);
            case 'BinaryExpression':
                return this.visitBinaryExpression(node as BinaryExpression, scope);
            case 'UnaryExpression':
                return this.visitUnaryExpression(node as UnaryExpression, scope);
            case 'UpdateExpression':
                return this.visitUpdateExpression(node as UpdateExpression, scope);
            case 'AssignmentExpression':
                return this.visitAssignmentExpression(node as AssignmentExpression, scope);
            case 'CallExpression':
                return this.visitCallExpression(node as CallExpression, scope);
            case 'MemberExpression':
                return this.visitMemberExpression(node as MemberExpression, scope);
            default:
                throw new Error(`Unknown expression type: ${(node as any).type}`);
        }
    }

    private visitIdentifier(node: Identifier, scope: Scope): any {
        // Check if it's an LV_* constant
        if (node.name.startsWith('LV_')) {
            if (this.constants && node.name in this.constants) {
                return this.constants[node.name];
            }
            throw this.createRuntimeError(`Unknown constant: ${node.name}`, node);
        }

        // Check if it's a global object
        if (node.name in this.globals) {
            return this.globals[node.name];
        }

        // Look up in scope chain
        let currentScope: any = scope;
        while (currentScope) {
            if (node.name in currentScope) {
                return currentScope[node.name];
            }
            currentScope = Object.getPrototypeOf(currentScope);
        }

        throw this.createRuntimeError(`Undefined variable: ${node.name}`, node);
    }

    private visitBinaryExpression(node: BinaryExpression, scope: Scope): any {
        const left = this.visitExpression(node.left, scope);
        const right = this.visitExpression(node.right, scope);

        switch (node.operator) {
            case '+':
                return left + right;
            case '-':
                return left - right;
            case '*':
                return left * right;
            case '/':
                return left / right;
            case '%':
                return left % right;
            case '==':
                return left == right;
            case '!=':
                return left != right;
            case '<':
                return left < right;
            case '>':
                return left > right;
            case '<=':
                return left <= right;
            case '>=':
                return left >= right;
            case '&&':
                return left && right;
            case '||':
                return left || right;
            case '|':
                return left | right;
            case '&':
                return left & right;
            case '^':
                return left ^ right;
            default:
                throw this.createRuntimeError(`Unknown binary operator: ${node.operator}`, node);
        }
    }

    private visitUnaryExpression(node: UnaryExpression, scope: Scope): any {
        const argument = this.visitExpression(node.argument, scope);

        switch (node.operator) {
            case '!':
                return !argument;
            case '-':
                return -argument;
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

    private visitUpdateExpression(node: UpdateExpression, scope: Scope): any {
        const delta = node.operator === '++' ? 1 : -1;
        return this.incrementVariable(node.argument, scope, delta, node.prefix);
    }

    private incrementVariable(node: Expression, scope: Scope, delta: number, prefix: boolean): any {
        if (node.type !== 'Identifier') {
            throw this.createRuntimeError('Can only increment variables', node);
        }

        const ident = node as Identifier;
        const oldValue = this.visitIdentifier(ident, scope);
        const newValue = oldValue + delta;

        // Find the scope that contains this variable and update it
        let currentScope: any = scope;
        while (currentScope) {
            if (Object.prototype.hasOwnProperty.call(currentScope, ident.name)) {
                currentScope[ident.name] = newValue;
                return prefix ? newValue : oldValue;
            }
            currentScope = Object.getPrototypeOf(currentScope);
        }

        // If not found in any scope, this shouldn't happen since visitIdentifier succeeded
        throw this.createRuntimeError(`Cannot increment undefined variable: ${ident.name}`, node);
    }

    private visitAssignmentExpression(node: AssignmentExpression, scope: Scope): any {
        const value = this.visitExpression(node.right, scope);

        if (node.left.type === 'Identifier') {
            const name = (node.left as Identifier).name;

            if (node.operator === '=') {
                // Find the scope that contains this variable and update it
                let currentScope: any = scope;
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
                const oldValue = this.visitIdentifier(node.left as Identifier, scope);
                let newValue: any;
                switch (node.operator) {
                    case '+=':
                        newValue = oldValue + value;
                        break;
                    case '-=':
                        newValue = oldValue - value;
                        break;
                    case '*=':
                        newValue = oldValue * value;
                        break;
                    case '/=':
                        newValue = oldValue / value;
                        break;
                    default:
                        throw this.createRuntimeError(`Unknown assignment operator: ${node.operator}`, node);
                }

                let currentScope: any = scope;
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

    private visitCallExpression(node: CallExpression, scope: Scope): any {
        // Evaluate callee
        let func: any;
        let thisContext: any = null;
        let functionName: string | null = null;
        let isGlobalFunction = false;

        if (node.callee.type === 'Identifier') {
            const name = (node.callee as Identifier).name;
            functionName = name;

            // Check if it's an lv_* function
            if (name.startsWith('lv_')) {
                // Check if function is in allowed list (if list is provided)
                if (this.allowedFunctions !== null && !this.allowedFunctions.includes(name)) {
                    throw this.createRuntimeError(`LVGL function not allowed: ${name}`, node);
                }

                const lvglFuncName = '_' + name;
                if (this.lvgl && typeof this.lvgl[lvglFuncName] === 'function') {
                    func = this.lvgl[lvglFuncName].bind(this.lvgl);
                } else {
                    throw this.createRuntimeError(`Unknown LVGL function: ${name}`, node);
                }
            } else {
                func = this.visitIdentifier(node.callee as Identifier, scope);
                // Check if this is a global function
                if (name in this.globals && typeof this.globals[name] === 'function') {
                    isGlobalFunction = true;
                    functionName = name;
                }
            }
        } else if (node.callee.type === 'MemberExpression') {
            const member = node.callee as MemberExpression;
            thisContext = this.visitExpression(member.object, scope);
            const propName = member.computed
                ? this.visitExpression(member.property as Expression, scope)
                : (member.property as string);
            func = thisContext[propName];

            // Build full path for global function type checking
            if (!member.computed) {
                const path = this.getMemberExpressionPath(member);
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
        const getArgumentDeclaredType = (argNode: Expression, innerScope: Scope): string | null => {
            if (argNode.type === 'Identifier') {
                const ident = argNode as Identifier;
                // Check if this identifier has a declared type in variableTypes
                let currentScope: any = innerScope;
                while (currentScope) {
                    if (ident.name in currentScope) {
                        // Found the variable, check if we have type info
                        if (ident.name in this.variableTypes) {
                            const varType = this.variableTypes[ident.name];
                            if (typeof varType === 'string') return varType;
                            return 'function';
                        }
                        break;
                    }
                    currentScope = Object.getPrototypeOf(currentScope);
                }
            }
            return null;
        };

        // Validate types for global functions if specified
        if (isGlobalFunction && functionName && functionName in this.globalFunctionTypes) {
            const typeSpec = this.globalFunctionTypes[functionName];

            // Check argument count
            if (args.length !== typeSpec.params.length) {
                throw this.createRuntimeError(
                    `Function ${functionName} expects ${typeSpec.params.length} argument(s), but got ${args.length}`,
                    node
                );
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
                } else if (!this.isTypeCompatible(actualType, expectedType)) {
                    const evalArg = args[i];
                    const displayType = typeof evalArg === 'function' ? 'function' : actualType;
                    throw this.createRuntimeError(
                        `Function ${functionName} parameter ${i + 1} expects type ${expectedType}, but got ${displayType}`,
                        node
                    );
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
                        throw this.createRuntimeError(
                            `Function ${functionName} expects ${expectedCount} argument(s), but got ${args.length}`,
                            node
                        );
                    }
                } else if (typeof expectedCount === 'object' && expectedCount) {
                    const min = expectedCount.min ?? 0;
                    const max = expectedCount.max ?? Infinity;
                    if (args.length < min || args.length > max) {
                        throw this.createRuntimeError(
                            `Function ${functionName} expects ${min}-${max} arguments, but got ${args.length}`,
                            node
                        );
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
                    } else if (!this.isTypeCompatible(actualType, expectedType)) {
                        const displayType = typeof args[i] === 'function' ? 'function' : actualType;
                        throw this.createRuntimeError(
                            `Function ${functionName} parameter ${i + 1} expects type ${expectedType}, but got ${displayType}`,
                            argNode
                        );
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
        if (isGlobalFunction && functionName && functionName in this.globalFunctionTypes) {
            const typeSpec = this.globalFunctionTypes[functionName];
            if (typeSpec.returnType && returnValue !== undefined) {
                const actualType = this.getValueType(returnValue);
                if (!this.isTypeCompatible(actualType, typeSpec.returnType)) {
                    throw this.createRuntimeError(
                        `Function ${functionName} return type mismatch: expected ${typeSpec.returnType}, but got ${actualType}`,
                        node
                    );
                }
            }
        }

        return returnValue;
    }

    private visitMemberExpression(node: MemberExpression, scope: Scope): any {
        const object = this.visitExpression(node.object, scope);
        const property = node.computed
            ? this.visitExpression(node.property as Expression, scope)
            : (node.property as string);

        return object[property];
    }

    callFunction(name: string, args: any[]): any {
        const func = this.functions[name];
        if (!func) {
            throw this.createRuntimeError(`Function not found: ${name}`);
        }

        // Create new scope for function execution
        const funcScope: Scope = Object.create(this.globalScope);

        // Bind parameters with type checking
        for (let i = 0; i < func.params.length; i++) {
            const param = func.params[i];
            const paramName = param.name;
            const paramType = param.type;

            // Type check parameter if type is specified
            if (paramType && args[i] !== undefined) {
                const actualType = this.getValueType(args[i]);

                // Auto-convert string to cstring
                if (paramType === 'cstring' && actualType === 'string') {
                    args[i] = this.convertStringToCString(args[i]);
                } else if (!this.isTypeCompatible(actualType, String(paramType))) {
                    throw this.createRuntimeError(
                        `Function ${name} parameter ${i + 1} expects type ${paramType}, but got ${actualType}`
                    );
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
            if (!this.isTypeCompatible(actualType, String(func.returnType))) {
                throw this.createRuntimeError(
                    `Function ${name} return type mismatch: expected ${func.returnType}, but got ${actualType}`
                );
            }
        }

        return returnValue;
    }
}

// ---------------------------------------------------------------------------
// PUBLIC API
// ---------------------------------------------------------------------------

const EEZ_SCRIPT_VERSION = '1.0.0';

interface VersionInfo {
    version: string;
    name: string;
    description: string;
    features: string[];
}

function eez_script_version(): VersionInfo {
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

interface ValidationResult {
    valid: boolean;
    ast?: Program;
    error?: string;
}

function eez_script_validate(script: string): ValidationResult {
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
            error: (error as Error).message
        };
    }
}

interface CompiledScript {
    _ast: Program;
    _interpreter: Interpreter | null;
    _sourceCode: string;
    _allowedFunctions: AllowedFunctions | null;
    init: (globals: Globals, lvgl: LVGLInstance, constants: LVGLConstants, allowedFunctions?: AllowedFunctions) => void;
    exec: (functionName: string, ...args: any[]) => any;
    emitJS: () => string;
    emitC: () => string;
}

function eez_script_compile(script: string): CompiledScript {
    let ast: Program;

    try {
        // Tokenize
        const lexer = new Lexer(script);
        const tokens = lexer.tokenize();

        // Parse
        const parser = new Parser(tokens);
        ast = parser.parseProgram();
    } catch (error) {
        throw new Error(`Parse error: ${(error as Error).message}`);
    }

    return {
        _ast: ast,
        _interpreter: null,
        _sourceCode: script,
        _allowedFunctions: null,

        // Initialize with globals, lvgl instance, constants, and optional allowed functions list
        // globals can include type specifications: { funcName: { function: fn, params: [...], returnType: type } }
        init: function (globals: Globals, lvgl: LVGLInstance, constants: LVGLConstants, allowedFunctions?: AllowedFunctions): void {
            this._interpreter = new Interpreter(globals, lvgl, constants, allowedFunctions);
            this._interpreter.sourceCode = this._sourceCode;
            this._interpreter.execute(this._ast);
            this._allowedFunctions = allowedFunctions || null;
        },

        // Execute a function by name with arguments
        exec: function (functionName: string, ...args: any[]): any {
            if (!this._interpreter) {
                throw new Error(
                    'Script not initialized. Call init(globals, lvgl, LVGL_CONSTANTS, allowedFunctions) first.'
                );
            }

            return this._interpreter.callFunction(functionName, args);
        },

        // Generate JavaScript code from EEZ Script AST
        emitJS: function (): string {
            return emitJS(this._ast, this._allowedFunctions || undefined);
        },

        // Generate C code from EEZ Script AST
        emitC: function (): string {
            return emitC(this._ast, this._allowedFunctions || undefined);
        }
    };
}

// Shared type inference - collects type information from AST
interface TypeInformation {
    varTypes: Record<string, string>;
    funcParamTypes: Record<string, Record<string, string>>;
    functionTypeMap: Record<string, FunctionTypeSpec>;
}

function collectTypeInformation(ast: Program, allowedFunctions?: AllowedFunctions): TypeInformation {
    const varTypes: Record<string, string> = {};
    const funcParamTypes: Record<string, Record<string, string>> = {};
    const functionTypeMap: Record<string, FunctionTypeSpec> = {};

    // Helper to infer type from an expression during type collection
    function inferTypeFromInit(expr: Expression | null): string | null {
        if (!expr) return null;

        // If it's a call expression, try to get the return type
        if (expr.type === 'CallExpression' && (expr as CallExpression).callee.type === 'Identifier') {
            const functionName = ((expr as CallExpression).callee as Identifier).name;

            // Check in functionTypeMap for return type
            if (functionTypeMap[functionName]) {
                return functionTypeMap[functionName].returnType || null;
            }
        }

        // If it's a literal, infer from the literal type
        if (expr.type === 'Literal') {
            const v = (expr as Literal).value;
            if (typeof v === 'number') return 'number';
            if (typeof v === 'boolean') return 'bool';
            if (typeof v === 'string') return 'string';
        }

        // If it's an identifier, look up its type
        if (expr.type === 'Identifier') {
            return varTypes[(expr as Identifier).name] || null;
        }

        return null;
    }

    // Traverse AST to collect type information
    function collectTypes(node: ASTNode | null, currentFunc: string | null = null): void {
        if (!node) return;

        if (node.type === 'Program') {
            (node as Program).body.forEach(stmt => collectTypes(stmt, null));
        } else if (node.type === 'FunctionDeclaration') {
            const fn = node as FunctionDeclaration;
            if (fn.params) {
                funcParamTypes[fn.name] = {};
                fn.params.forEach(p => {
                    if (p.type) {
                        funcParamTypes[fn.name][p.name] = String(p.type);
                    }
                });
            }
            collectTypes(fn.body, fn.name);
        } else if (node.type === 'VariableDeclaration') {
            const vd = node as VariableDeclaration;
            const key = currentFunc ? `${currentFunc}.${vd.name}` : vd.name;

            // Use explicit type if provided, otherwise try to infer
            if (vd.varType) {
                varTypes[key] = String(vd.varType);
            } else if (vd.init) {
                const inferredType = inferTypeFromInit(vd.init);
                if (inferredType) {
                    varTypes[key] = inferredType;
                }
            }
        } else if (node.type === 'BlockStatement') {
            (node as BlockStatement).body.forEach(stmt => collectTypes(stmt, currentFunc));
        } else if (node.type === 'IfStatement') {
            const ifs = node as IfStatement;
            collectTypes(ifs.consequent, currentFunc);
            if (ifs.alternate) collectTypes(ifs.alternate, currentFunc);
        } else if (node.type === 'ForStatement') {
            const fs = node as ForStatement;
            if (fs.init) collectTypes(fs.init as any, currentFunc);
            collectTypes(fs.body, currentFunc);
        } else if (node.type === 'WhileStatement') {
            collectTypes((node as WhileStatement).body, currentFunc);
        }
    }

    // Build function type map from allowedFunctions
    if (allowedFunctions && typeof allowedFunctions === 'object' && !Array.isArray(allowedFunctions)) {
        for (const funcName in allowedFunctions) {
            const funcSpec = allowedFunctions[funcName];
            if (funcSpec && typeof funcSpec === 'object' && 'params' in funcSpec) {
                functionTypeMap[funcName] = funcSpec as FunctionTypeSpec;
            }
        }
    }

    collectTypes(ast);

    return { varTypes, funcParamTypes, functionTypeMap };
}

// JavaScript code emitter - converts AST to JavaScript code
function emitJS(ast: Program, allowedFunctions?: AllowedFunctions): string {
    // Collect type information (explicit and inferred)
    const { varTypes, funcParamTypes, functionTypeMap } = collectTypeInformation(ast, allowedFunctions);

    type EmitContext = { currentFunction?: string };

    function getIdentifierType(name: string, context: EmitContext): string | null {
        // Check if it's a parameter of the current function
        if (context.currentFunction && funcParamTypes[context.currentFunction] && funcParamTypes[context.currentFunction][name]) {
            return funcParamTypes[context.currentFunction][name];
        }
        // Check if it's a local variable
        const localKey = context.currentFunction ? `${context.currentFunction}.${name}` : name;
        if (varTypes[localKey]) {
            return varTypes[localKey];
        }
        // Check if it's a global variable
        if (varTypes[name]) {
            return varTypes[name];
        }
        return null;
    }

    function emit(node: ASTNode | null, indent: number = 0, context: EmitContext = {}): string {
        const indentStr = '    '.repeat(indent);
        if (!node) return '';

        switch (node.type) {
            case 'Program':
                return (node as Program).body.map(stmt => emit(stmt, indent, context)).join('\n');

            case 'FunctionDeclaration': {
                const fn = node as FunctionDeclaration;
                const fnParams = fn.params.map(p => p.name).join(', ');
                const fnContext: EmitContext = { ...context, currentFunction: fn.name };
                const fnBody = emit(fn.body, indent, fnContext);
                return `${indentStr}function ${fn.name}(${fnParams}) ${fnBody}`;
            }

            case 'VariableDeclaration': {
                const vd = node as VariableDeclaration;
                let varInit = '';
                if (vd.init) {
                    const initExpr = emit(vd.init, 0, context);
                    // Check if we need to wrap with System.stringToNewUTF8
                    if (vd.varType === 'cstring' && vd.init.type === 'Literal' && typeof (vd.init as Literal).value === 'string') {
                        varInit = ' = System.stringToNewUTF8(' + initExpr + ')';
                    } else if (vd.varType === 'lv_color') {
                        if (
                            vd.init.type === 'CallExpression' &&
                            (vd.init as CallExpression).callee.type === 'Identifier' &&
                            ((vd.init as CallExpression).callee as Identifier).name === 'lv_color_hex'
                        ) {
                            const colorArg = emit((vd.init as CallExpression).arguments[0], 0, context);
                            varInit = ` = (() => { if (!lvgl._colorBuffer) lvgl._colorBuffer = lvgl._lv_malloc(4); lvgl._lv_color_hex(lvgl._colorBuffer, ${colorArg}); return lvgl._colorBuffer; })()`;
                        } else {
                            varInit = ' = ' + initExpr;
                        }
                    } else {
                        varInit = ' = ' + initExpr;
                    }
                }
                return `${indentStr}${vd.kind} ${vd.name}${varInit};`;
            }

            case 'ExpressionStatement':
                return `${indentStr}${emit((node as ExpressionStatement).expression, 0, context)};`;

            case 'BlockStatement': {
                const statements = (node as BlockStatement).body.map(stmt => emit(stmt, indent + 1, context)).join('\n');
                return `{\n${statements}\n${indentStr}}`;
            }

            case 'IfStatement': {
                const ifs = node as IfStatement;
                let ifResult = `${indentStr}if (${emit(ifs.test, 0, context)}) ${emit(ifs.consequent, indent, context)}`;
                if (ifs.alternate) {
                    if (ifs.alternate.type === 'IfStatement') {
                        ifResult += ' else ' + emit(ifs.alternate, indent, context).trim();
                    } else {
                        ifResult += ' else ' + emit(ifs.alternate, indent, context);
                    }
                }
                return ifResult;
            }

            case 'ForStatement': {
                const fs = node as ForStatement;
                const forInit = fs.init ? emit(fs.init as any, 0, context).trim().replace(/;$/, '') : '';
                const forTest = fs.test ? emit(fs.test, 0, context) : '';
                const forUpdate = fs.update ? emit(fs.update, 0, context) : '';
                return `${indentStr}for (${forInit}; ${forTest}; ${forUpdate}) ${emit(fs.body, indent, context)}`;
            }

            case 'WhileStatement':
                return `${indentStr}while (${emit((node as WhileStatement).test, 0, context)}) ${emit((node as WhileStatement).body, indent, context)}`;

            case 'ReturnStatement': {
                const rs = node as ReturnStatement;
                const retArg = rs.argument ? ' ' + emit(rs.argument, 0, context) : '';
                return `${indentStr}return${retArg};`;
            }

            case 'BinaryExpression': {
                const be = node as BinaryExpression;
                return `${emit(be.left, 0, context)} ${be.operator} ${emit(be.right, 0, context)}`;
            }

            case 'UnaryExpression': {
                const ue = node as UnaryExpression;
                return `${ue.operator}${emit(ue.argument, 0, context)}`;
            }

            case 'UpdateExpression': {
                const ue = node as UpdateExpression;
                if (ue.prefix) return `${ue.operator}${emit(ue.argument, 0, context)}`;
                return `${emit(ue.argument, 0, context)}${ue.operator}`;
            }

            case 'AssignmentExpression': {
                const ae = node as AssignmentExpression;
                return `${emit(ae.left, 0, context)} ${ae.operator} ${emit(ae.right, 0, context)}`;
            }

            case 'CallExpression': {
                const ce = node as CallExpression;
                let calleeName: string | null = null;
                let calleePrefix = '';

                if (ce.callee.type === 'Identifier' && (ce.callee as Identifier).name.startsWith('lv_')) {
                    calleeName = (ce.callee as Identifier).name;
                    calleePrefix = 'lvgl._';
                }

                const funcTypeInfo = calleeName ? functionTypeMap[calleeName] : null;

                const expectsCString = !!(calleeName && (calleeName.includes('set_text') || calleeName.includes('set_label') || calleeName.includes('add_text')));

                const emittedArgs = ce.arguments.map((arg, index) => {
                    let argCode = emit(arg, 0, context);
                    let needsConversion = false;
                    let isLvColor = false;

                    if (funcTypeInfo && funcTypeInfo.params && funcTypeInfo.params[index]) {
                        const expectedType = funcTypeInfo.params[index];

                        if (expectedType === 'lv_color') {
                            isLvColor = true;
                            if (arg.type === 'Identifier') {
                                const identType = getIdentifierType((arg as Identifier).name, context);
                                if (identType === 'lv_color') isLvColor = false;
                            }
                            if (arg.type === 'CallExpression' && (arg as CallExpression).callee.type === 'Identifier' && ((arg as CallExpression).callee as Identifier).name === 'lv_color_hex') {
                                isLvColor = false;
                            }
                        }

                        if (expectedType === 'cstring') {
                            if (arg.type === 'Literal' && typeof (arg as Literal).value === 'string') {
                                needsConversion = true;
                            } else if (arg.type === 'Identifier') {
                                const argType = getIdentifierType((arg as Identifier).name, context);
                                needsConversion = argType !== 'cstring' && argType === 'string';
                            }
                        }
                    }

                    if (arg.type === 'Literal' && typeof (arg as Literal).value === 'string') {
                        needsConversion = expectsCString;
                    } else if (arg.type === 'Identifier') {
                        const identType = getIdentifierType((arg as Identifier).name, context);
                        if (identType === 'string' && expectsCString) needsConversion = true;
                    }

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
                    return `${calleePrefix}${calleeName}(${args})`;
                }
                return `${emit(ce.callee, 0, context)}(${args})`;
            }

            case 'MemberExpression': {
                const me = node as MemberExpression;
                if (me.computed) {
                    return `${emit(me.object, 0, context)}[${emit(me.property as any, 0, context)}]`;
                }
                const propName = typeof me.property === 'string' ? me.property : emit(me.property, 0, context);
                return `${emit(me.object, 0, context)}.${propName}`;
            }

            case 'Identifier': {
                const ident = node as Identifier;
                if (ident.name.startsWith('LV_')) {
                    return `lvgl_const.${ident.name}`;
                }
                return ident.name;
            }

            case 'Literal': {
                const lit = node as Literal;
                if (typeof lit.value === 'string') {
                    return `"${lit.value.replace(/"/g, '\\"')}"`;
                }
                return String(lit.value);
            }

            default:
                throw new Error(`Unknown node type in emit: ${(node as any).type}`);
        }
    }

    return emit(ast);
}

// C code emitter - converts AST to C code
function emitC(ast: Program, allowedFunctions?: AllowedFunctions): string {
    // Collect type information (explicit and inferred)
    const { varTypes, funcParamTypes, functionTypeMap } = collectTypeInformation(ast, allowedFunctions);

    type EmitContext = { currentFunction?: string; stringBuffers?: Map<ASTNode, string> };

    function getIdentifierType(name: string, context: EmitContext): string | null {
        if (context.currentFunction && funcParamTypes[context.currentFunction] && funcParamTypes[context.currentFunction][name]) {
            return funcParamTypes[context.currentFunction][name];
        }
        const localKey = context.currentFunction ? `${context.currentFunction}.${name}` : name;
        if (varTypes[localKey]) return varTypes[localKey];
        if (varTypes[name]) return varTypes[name];
        return null;
    }

    function mapTypeToCType(type: string | null | undefined): string {
        if (!type) return 'void';
        switch (type) {
            case 'number':
                return 'int32_t';
            case 'bool':
                return 'bool';
            case 'string':
            case 'cstring':
                return 'const char*';
            case 'lv_obj':
                return 'lv_obj_t*';
            case 'lv_color':
                return 'lv_color_t';
            case 'function':
                return 'lv_event_cb_t';
            default:
                if (type.startsWith('lv_')) return type + '_t*';
                return type;
        }
    }

    function emit(node: ASTNode | null, indent: number = 0, context: EmitContext = {}): string {
        const indentStr = '    '.repeat(indent);
        if (!node) return '';

        switch (node.type) {
            case 'Program':
                return (node as Program).body.map(stmt => emit(stmt, indent, context)).join('\n\n');

            case 'FunctionDeclaration': {
                const fn = node as FunctionDeclaration;
                const returnType = mapTypeToCType(fn.returnType);
                const params = fn.params
                    .map(p => {
                        let paramType = mapTypeToCType(p.type);
                        if (p.type === 'number' && fn.params.length === 1) {
                            paramType = 'lv_event_t*';
                        }
                        return `${paramType} ${p.name}`;
                    })
                    .join(', ');
                const fnContext: EmitContext = { ...context, currentFunction: fn.name };
                const fnBody = emit(fn.body, indent, fnContext);
                return `${indentStr}${returnType} ${fn.name}(${params}) ${fnBody}`;
            }

            case 'VariableDeclaration': {
                const vd = node as VariableDeclaration;
                const key = context.currentFunction ? `${context.currentFunction}.${vd.name}` : vd.name;
                const collectedType = varTypes[key];
                const varType = mapTypeToCType(collectedType);
                let varInit = '';
                if (vd.init) {
                    varInit = ' = ' + emit(vd.init, 0, context);
                }
                return `${indentStr}${varType} ${vd.name}${varInit};`;
            }

            case 'ExpressionStatement': {
                const es = node as ExpressionStatement;
                let preamble = '';

                if (es.expression.type === 'CallExpression') {
                    const callNode = es.expression as CallExpression;

                    callNode.arguments.forEach(arg => {
                        if (arg.type === 'BinaryExpression' && (arg as BinaryExpression).operator === '+') {
                            const parts: ASTNode[] = [];

                            const collectParts = (n: ASTNode): void => {
                                if (n.type === 'BinaryExpression' && (n as BinaryExpression).operator === '+') {
                                    collectParts((n as BinaryExpression).left);
                                    collectParts((n as BinaryExpression).right);
                                } else {
                                    parts.push(n);
                                }
                            };

                            collectParts(arg);

                            const hasStringLiteral = parts.some(p => p.type === 'Literal' && typeof (p as Literal).value === 'string');

                            if (hasStringLiteral && parts.length > 1) {
                                let formatStr = '';
                                const sprintfArgs: string[] = [];

                                parts.forEach(part => {
                                    if (part.type === 'Literal' && typeof (part as Literal).value === 'string') {
                                        formatStr += String((part as Literal).value);
                                    } else {
                                        const partType = part.type === 'Identifier' ? getIdentifierType((part as Identifier).name, context) : 'number';

                                        if (partType === 'number' || !partType) formatStr += '%d';
                                        else if (partType === 'string' || partType === 'cstring') formatStr += '%s';
                                        else formatStr += '%d';

                                        sprintfArgs.push(emit(part, 0, context));
                                    }
                                });

                                const bufferName = `_str_buf`;
                                const argsStr = sprintfArgs.length > 0 ? ', ' + sprintfArgs.join(', ') : '';

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

                return preamble + `${indentStr}${emit(es.expression, 0, context)};`;
            }

            case 'BlockStatement': {
                const statements = (node as BlockStatement).body.map(stmt => emit(stmt, indent + 1, context)).join('\n');
                return `{\n${statements}\n${indentStr}}`;
            }

            case 'IfStatement': {
                const ifs = node as IfStatement;
                let ifResult = `${indentStr}if (${emit(ifs.test, 0, context)}) ${emit(ifs.consequent, indent, context)}`;
                if (ifs.alternate) {
                    if (ifs.alternate.type === 'IfStatement') {
                        ifResult += ' else ' + emit(ifs.alternate, indent, context).trim();
                    } else {
                        ifResult += ' else ' + emit(ifs.alternate, indent, context);
                    }
                }
                return ifResult;
            }

            case 'ForStatement': {
                const fs = node as ForStatement;
                const forInit = fs.init ? emit(fs.init as any, 0, context).trim().replace(/;$/, '') : '';
                const forTest = fs.test ? emit(fs.test, 0, context) : '';
                const forUpdate = fs.update ? emit(fs.update, 0, context) : '';
                return `${indentStr}for (${forInit}; ${forTest}; ${forUpdate}) ${emit(fs.body, indent, context)}`;
            }

            case 'WhileStatement': {
                const ws = node as WhileStatement;
                return `${indentStr}while (${emit(ws.test, 0, context)}) ${emit(ws.body, indent, context)}`;
            }

            case 'ReturnStatement': {
                const rs = node as ReturnStatement;
                const retArg = rs.argument ? ' ' + emit(rs.argument, 0, context) : '';
                return `${indentStr}return${retArg};`;
            }

            case 'BinaryExpression': {
                if (context.stringBuffers && context.stringBuffers.has(node)) {
                    return context.stringBuffers.get(node)!;
                }
                const be = node as BinaryExpression;
                return `${emit(be.left, 0, context)} ${be.operator} ${emit(be.right, 0, context)}`;
            }

            case 'UnaryExpression': {
                const ue = node as UnaryExpression;
                return `${ue.operator}${emit(ue.argument, 0, context)}`;
            }

            case 'UpdateExpression': {
                const ue = node as UpdateExpression;
                if (ue.prefix) return `${ue.operator}${emit(ue.argument, 0, context)}`;
                return `${emit(ue.argument, 0, context)}${ue.operator}`;
            }

            case 'AssignmentExpression': {
                const ae = node as AssignmentExpression;
                return `${emit(ae.left, 0, context)} ${ae.operator} ${emit(ae.right, 0, context)}`;
            }

            case 'CallExpression': {
                const ce = node as CallExpression;
                let calleeName: string | null = null;

                if (ce.callee.type === 'Identifier' && (ce.callee as Identifier).name.startsWith('lv_')) {
                    calleeName = (ce.callee as Identifier).name;
                }

                const funcTypeInfo = calleeName ? functionTypeMap[calleeName] : null;

                const emittedArgs = ce.arguments.map((arg, index) => {
                    if (context.stringBuffers && context.stringBuffers.has(arg)) {
                        return context.stringBuffers.get(arg)!;
                    }

                    const argCode = emit(arg, 0, context);

                    if (funcTypeInfo && funcTypeInfo.params && funcTypeInfo.params[index]) {
                        const expectedType = funcTypeInfo.params[index];
                        if (expectedType === 'lv_color') {
                            if (!(arg.type === 'CallExpression' && (arg as CallExpression).callee.type === 'Identifier' && ((arg as CallExpression).callee as Identifier).name === 'lv_color_hex')) {
                                if (arg.type === 'Identifier' && getIdentifierType((arg as Identifier).name, context) === 'lv_color') {
                                    return argCode;
                                }
                                return `lv_color_hex(${argCode})`;
                            }
                        }
                    }

                    return argCode;
                });

                const args = emittedArgs.join(', ');

                if (calleeName) {
                    return `${calleeName}(${args})`;
                }
                return `${emit(ce.callee, 0, context)}(${args})`;
            }

            case 'MemberExpression': {
                const me = node as MemberExpression;
                if (me.computed) {
                    return `${emit(me.object, 0, context)}[${emit(me.property as any, 0, context)}]`;
                }
                const propName = typeof me.property === 'string' ? me.property : emit(me.property, 0, context);
                return `${emit(me.object, 0, context)}.${propName}`;
            }

            case 'Identifier':
                return (node as Identifier).name;

            case 'Literal': {
                const lit = node as Literal;
                if (typeof lit.value === 'string') {
                    return `"${String(lit.value).replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
                }
                if (typeof lit.value === 'boolean') {
                    return lit.value ? 'true' : 'false';
                }
                if (lit.value === null) return 'NULL';
                return String(lit.value);
            }

            default:
                throw new Error(`Unknown node type in emit: ${(node as any).type}`);
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

export {
    eez_script_compile,
    eez_script_version,
    eez_script_validate,
    emitC,
    emitJS,
    collectTypeInformation,
    Lexer,
    Parser,
    Interpreter
};
