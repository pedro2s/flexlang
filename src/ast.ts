export enum TokenType {
  Number = "NUMBER",
  String = "STRING",
  Let = "LET",
  Mut = "MUT",
  Enum = "ENUM",
  Match = "MATCH",
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
  FatArrow = "FAT_ARROW", // =>
  Question = "QUESTION", // ?
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
  Struct = "STRUCT", // struct
  Dot = "DOT", // .
  Impl = "IMPL",
  Self = "SELF",
  Minus = "MINUS", // -
  Star = "STAR", // *
  Slash = "SLASH", // /
  NotEq = "NOTEQ", // !=
  LtEq = "LTEQ", // <=
  GtEq = "GTEQ", // >=
  And = "AND", // &&
  Or = "OR", // ||
  Bang = "BANG", // !
  Modulo = "MODULO", // %
  While = "WHILE",
  LBracket = "LBRACKET", // [
  RBracket = "RBRACKET", // ]
  True = "TRUE", // true
  False = "FALSE", // false
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

// --- Definição da AST (Discriminated Unions) ---

export type Stmt =
  | VarDeclaration
  | PrintStmt
  | IfStmt
  | ForStmt
  | WhileStmt
  | BlockStmt
  | FunctionDeclaration
  | ReturnStmt
  | StructDeclaration
  | ImplDeclaration
  | EnumDeclaration
  | MatchStmt
  | ExpressionStatement;

export type Expr =
  | NumericLiteral
  | BooleanLiteral
  | StringLiteral
  | StringInterpolationExpr
  | Identifier
  | BinaryExpr
  | LogicalExpr
  | UnaryExpr
  | CallExpr
  | StructExpr
  | MemberExpr
  | ArrayLiteral
  | IndexExpr
  | TryExpr
  | AssignmentExpr;

export interface BooleanLiteral {
  kind: "BooleanLiteral";
  value: boolean;
}

export interface ExpressionStatement {
  kind: "ExpressionStatement";
  expression: Expr;
}

// --- Definição dos Nós de Tipagem ---

export type TypeNode =
  | NamedTypeNode
  | GenericTypeNode
  | ArrayTypeNode;

export interface NamedTypeNode {
  kind: "NamedTypeNode";
  name: string; // ex: "Int", "String"
}

export interface GenericTypeNode {
  kind: "GenericTypeNode";
  name: string; // ex: "Result"
  typeArguments: TypeNode[]; // ex: [NamedTypeNode("Int")]
}

export interface ArrayTypeNode {
  kind: "ArrayTypeNode";
  elementType: TypeNode; // ex: [Int] (Array de Int)
}

// --- Fim Tipagem ---

export interface AssignmentExpr {
  kind: "AssignmentExpr";
  assignee: Identifier | MemberExpr | IndexExpr; // Target of the assignment (e.g., Identifier or MemberExpr)
  value: Expr;
}

export interface StringInterpolationExpr {
  kind: "StringInterpolationExpr";
  parts: (string | Expr)[];
}

export interface LogicalExpr {
  kind: "LogicalExpr";
  left: Expr;
  operator: string;
  right: Expr;
}

export interface UnaryExpr {
  kind: "UnaryExpr";
  operator: string;
  argument: Expr;
}

export interface WhileStmt {
  kind: "WhileStmt";
  condition: Expr;
  body: BlockStmt;
}

export interface ArrayLiteral {
  kind: "ArrayLiteral";
  elements: Expr[];
}

export interface IndexExpr {
  kind: "IndexExpr";
  object: Expr;
  index: Expr;
}

export interface ImplDeclaration {
  kind: "ImplDeclaration";
  structName: string;
  methods: FunctionDeclaration[];
}

export interface StructDeclaration {
  kind: "StructDeclaration";
  name: string;
  properties: { name: string; typeAnnotation: TypeNode }[];
}

export interface StructExpr {
  kind: "StructExpr";
  structName: string;
  properties: { name: string; value: Expr }[];
}

export interface MemberExpr {
  kind: "MemberExpr";
  object: Expr; // A variável que guarda a struct (ex: p)
  property: string; // O nome da propriedade (ex: x)
}

export interface Parameter {
  name: string;
  typeAnnotation: TypeNode;
}

export interface FunctionDeclaration {
  kind: "FunctionDeclaration";
  name: string;
  parameters: Parameter[];
  returnType?: TypeNode | undefined;
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
  typeAnnotation?: TypeNode | undefined;
  isMut: boolean;
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

// --- Enum e Pattern Matching ---

export interface EnumVariantDecl {
  name: string;
  payload?: TypeNode[];
}

export interface EnumDeclaration {
  kind: "EnumDeclaration";
  name: string;
  variants: EnumVariantDecl[];
}

export interface MatchArm {
  enumName: string;
  variantName: string;
  binders: string[]; // Variáveis para mapear o payload (ex: v em Ok(v))
  body: BlockStmt;
}

export interface MatchStmt {
  kind: "MatchStmt";
  value: Expr;
  arms: MatchArm[];
}

export interface TryExpr {
  kind: "TryExpr";
  expression: Expr;
}
