export enum TokenType {
  Number = "NUMBER",
  String = "STRING",
  Let = "LET",
  Print = "PRINT",
  If = "IF", // Novos tokens para controle de fluxo
  Else = "ELSE",
  For = "FOR", // Novos tokens de laços
  In = "IN", // Palavra-chave para laços
  Identifier = "ID",
  Assign = "ASSIGN",
  Plus = "PLUS",
  EqEq = "EQEQ", // Operadores de comparação (==, >, <)
  Gt = "GT",
  Lt = "LT",
  DotDot = "DOTDOT", // Operador de range (..)
  Colon = "COLON",
  Semi = "SEMI",
  LParen = "LPAREN",
  RParen = "RPAREN",
  LBrace = "LBRACE", // Chaves { }
  RBrace = "RBRACE",
  EOF = "EOF",
  Func = "FUNC",
  Return = "RETURN",
  Comma = "COMMA", // Vírgula
  Arrow = "ARROW", // ->
}

export interface Token {
  type: TokenType;
  value: string;
}

// --- Definição da AST (Discriminated Unions) ---

export type Stmt =
  | VarDeclaration
  | PrintStmt
  | IfStmt
  | ForStmt
  | BlockStmt
  | FunctionDeclaration
  | ReturnStmt;
export type Expr =
  | NumericLiteral
  | StringLiteral
  | Identifier
  | BinaryExpr
  | CallExpr;

export interface Parameter {
  name: string;
  typeAnnotation: string;
}

export interface FunctionDeclaration {
  kind: "FunctionDeclaration";
  name: string;
  parameters: Parameter[];
  returnType?: string | undefined;
  body: BlockStmt;
}

export interface ReturnStmt {
  kind: "ReturnStmt";
  value?: Expr | undefined;
}

export interface CallExpr {
  kind: "CallExpr";
  caller: Expr; // Geralmente Identifier para funções
  args: Expr[];
}

export interface BlockStmt {
  kind: "BlockStmt";
  body: Stmt[];
}

export interface IfStmt {
  kind: "IfStmt";
  condition: Expr;
  consequent: BlockStmt;
  alternate?: BlockStmt | undefined; // Opcional, pois pode não ter 'else'
}

export interface ForStmt {
  kind: "ForStmt";
  iteratorName: string;
  start: Expr;
  end: Expr;
  body: BlockStmt;
}

export interface VarDeclaration {
  kind: "VarDeclaration";
  name: string;
  value: Expr;
  typeAnnotation?: string | undefined;
}

export interface PrintStmt {
  kind: "PrintStmt";
  value: Expr;
}

export interface BinaryExpr {
  kind: "BinaryExpr";
  left: Expr;
  operator: string;
  right: Expr;
}

export interface NumericLiteral {
  kind: "NumericLiteral";
  value: number;
}

export interface StringLiteral {
  kind: "StringLiteral";
  value: string;
}

export interface Identifier {
  kind: "Identifier";
  symbol: string;
}
