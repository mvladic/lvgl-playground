// Type definitions for EEZ Script (src/eez-script.js)
// This is a lightweight, best-effort typing surface for editor IntelliSense.

export as namespace eezScript;

declare namespace EEZScript {
  type PrimitiveType = 'number' | 'bool' | 'string' | 'cstring' | 'lv_color' | 'function' | string;

  interface Token {
    type: string;
    value?: any;
  }

  interface SourceLocation {
    line: number;
    column: number;
  }

  interface BaseNode {
    type: string;
    loc?: SourceLocation;
  }

  interface ProgramNode extends BaseNode {
    type: 'Program';
    body: StatementNode[];
  }

  type StatementNode =
    | FunctionDeclarationNode
    | VariableDeclarationNode
    | IfStatementNode
    | ForStatementNode
    | WhileStatementNode
    | ReturnStatementNode
    | BlockStatementNode
    | ExpressionStatementNode;

  interface BlockStatementNode extends BaseNode {
    type: 'BlockStatement';
    body: StatementNode[];
  }

  interface ExpressionStatementNode extends BaseNode {
    type: 'ExpressionStatement';
    expression: ExpressionNode;
  }

  interface FunctionParam {
    name: string;
    type: PrimitiveType | null;
  }

  interface FunctionDeclarationNode extends BaseNode {
    type: 'FunctionDeclaration';
    name: string;
    params: FunctionParam[];
    returnType: PrimitiveType | null;
    body: BlockStatementNode;
  }

  interface VariableDeclarationNode extends BaseNode {
    type: 'VariableDeclaration';
    kind: 'let' | 'const';
    name: string;
    varType: PrimitiveType | null;
    init: ExpressionNode | null;
  }

  interface IfStatementNode extends BaseNode {
    type: 'IfStatement';
    test: ExpressionNode;
    consequent: StatementNode;
    alternate: StatementNode | null;
  }

  interface ForStatementNode extends BaseNode {
    type: 'ForStatement';
    init: VariableDeclarationNode | ExpressionNode | null;
    test: ExpressionNode | null;
    update: ExpressionNode | null;
    body: StatementNode;
  }

  interface WhileStatementNode extends BaseNode {
    type: 'WhileStatement';
    test: ExpressionNode;
    body: StatementNode;
  }

  interface ReturnStatementNode extends BaseNode {
    type: 'ReturnStatement';
    argument: ExpressionNode | null;
  }

  type ExpressionNode =
    | LiteralNode
    | IdentifierNode
    | BinaryExpressionNode
    | UnaryExpressionNode
    | UpdateExpressionNode
    | AssignmentExpressionNode
    | CallExpressionNode
    | MemberExpressionNode;

  interface LiteralNode extends BaseNode {
    type: 'Literal';
    value: any;
  }

  interface IdentifierNode extends BaseNode {
    type: 'Identifier';
    name: string;
  }

  interface BinaryExpressionNode extends BaseNode {
    type: 'BinaryExpression';
    operator: string;
    left: ExpressionNode;
    right: ExpressionNode;
  }

  interface UnaryExpressionNode extends BaseNode {
    type: 'UnaryExpression';
    operator: string;
    prefix: boolean;
    argument: ExpressionNode;
  }

  interface UpdateExpressionNode extends BaseNode {
    type: 'UpdateExpression';
    operator: string;
    prefix: boolean;
    argument: ExpressionNode;
  }

  interface AssignmentExpressionNode extends BaseNode {
    type: 'AssignmentExpression';
    operator: string;
    left: ExpressionNode;
    right: ExpressionNode;
  }

  interface CallExpressionNode extends BaseNode {
    type: 'CallExpression';
    callee: ExpressionNode;
    arguments: ExpressionNode[];
  }

  interface MemberExpressionNode extends BaseNode {
    type: 'MemberExpression';
    object: ExpressionNode;
    property: any;
    computed: boolean;
  }

  interface EEZScriptVersionInfo {
    version: string;
    name: string;
    description: string;
    features: string[];
  }

  interface ValidationOk {
    valid: true;
    ast: ProgramNode;
  }

  interface ValidationError {
    valid: false;
    error: string;
  }

  type ValidationResult = ValidationOk | ValidationError;

  type ArgCountSpec = number | { min?: number; max?: number };

  interface FunctionTypeSpec {
    params: PrimitiveType[];
    returnType?: PrimitiveType;
  }

  type AllowedFunctions =
    | null
    | string[]
    | Record<string, ArgCountSpec | FunctionTypeSpec>;

  interface GlobalsObject {
    [key: string]: any;
    System?: {
      stringToNewUTF8?: (value: string) => number;
    };
  }

  interface LVGLConstants {
    [constantName: string]: number;
  }

  interface CompiledScript {
    init: (
      globals: GlobalsObject,
      lvgl: any,
      constants: LVGLConstants,
      allowedFunctions?: AllowedFunctions
    ) => void;

    exec: (functionName: string, ...args: any[]) => any;

    emitJS: () => string;
    emitC: () => string;
  }

  interface Exports {
    eez_script_compile: typeof eez_script_compile;
    eez_script_version: typeof eez_script_version;
    eez_script_validate: typeof eez_script_validate;
    Lexer: typeof Lexer;
    Parser: typeof Parser;
    Interpreter: typeof Interpreter;
  }
}

/**
 * Browser global: returns version info.
 */
declare function eez_script_version(): EEZScript.EEZScriptVersionInfo;

/**
 * Browser global: validates and returns an AST on success.
 */
declare function eez_script_validate(script: string): EEZScript.ValidationResult;

/**
 * Browser global: compiles a script into an executable handle.
 */
declare function eez_script_compile(script: string): EEZScript.CompiledScript;

declare class Lexer {
  constructor(input: string);
  peek(): string | undefined;
  advance(): string | undefined;
  skipWhitespace(): void;
  skipLineComment(): void;
  skipBlockComment(): void;
  readNumber(): EEZScript.Token;
  readString(quote: string): EEZScript.Token;
  readIdentifier(): EEZScript.Token;
  nextToken(): EEZScript.Token;
  tokenize(): EEZScript.Token[];
}

declare class Parser {
  constructor(tokens: EEZScript.Token[]);
  peek(): EEZScript.Token;
  advance(): EEZScript.Token;
  expect(type: string): EEZScript.Token;
  parseProgram(): EEZScript.ProgramNode;
}

declare class Interpreter {
  constructor(
    globals: EEZScript.GlobalsObject,
    lvgl: any,
    constants: EEZScript.LVGLConstants,
    allowedFunctions?: EEZScript.AllowedFunctions
  );

  execute(ast: EEZScript.ProgramNode): void;
}

declare const eezScript: EEZScript.Exports;
export = eezScript;
