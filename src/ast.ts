export enum TokenType {
  Number = "NUMBER",
  Let = "LET",
  Print = "PRINT",
  Identifier = "ID",
  Assign = "ASSIGN",
  Plus = "PLUS",
  Colon = "COLON",
  Semi = "SEMI",
  LParen = "LPAREN",
  RParen = "RPAREN",
  EOF = "EOF",
}

export interface Token {
  type: TokenType;
  value: string;
}

// --- Definição da AST (Discriminated Unions) ---

export type Stmt = VarDeclaration | PrintStmt;
export type Expr = NumericLiteral | Identifier | BinaryExpr;

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

export interface Identifier {
  kind: "Identifier";
  symbol: string;
}
