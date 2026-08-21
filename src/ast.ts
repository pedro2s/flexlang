export enum TokenType {
  Number = "NUMBER",
  String = "STRING",
  Let = "LET",
  Const = "CONST",
  Mut = "MUT",
  Enum = "ENUM",
  Match = "MATCH",
  Scope = "SCOPE",
  Spawn = "SPAWN",
  Trait = "TRAIT",
  Import = "IMPORT",
  From = "FROM",
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
  Pipe = "PIPE", // | (delimitador de parâmetros de lambda)
  Break = "BREAK", // break
  Continue = "CONTINUE", // continue
  Catch = "CATCH", // catch (RFC-029)
  Hash = "HASH", // # (RFC-041 attributes como #[test])
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

export interface Span {
  file: string; // caminho absoluto — obrigatório em projeto multi-arquivo
  line: number; // 1-based
  column: number; // 1-based
  endLine: number;
  endColumn: number;
}

// --- Definição da AST (Discriminated Unions) ---

export type Stmt =
  | VarDeclaration
  | ConstDeclaration
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
  | ScopeStmt
  | SpawnStmt
  | TraitDeclaration
  | ImportDeclaration
  | BreakStmt
  | ContinueStmt
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
  | AssignmentExpr
  | LambdaExpr
  | MapLiteral
  | RangeExpr
  | CatchExpr;

export interface RangeExpr {
  kind: "RangeExpr";
  start: Expr;
  end: Expr;
  span?: Span;
}

export interface BooleanLiteral {
  kind: "BooleanLiteral";
  value: boolean;
  span?: Span;
}

export interface ExpressionStatement {
  kind: "ExpressionStatement";
  expression: Expr;
  span?: Span;
}

// --- Definição dos Nós de Tipagem ---

export type TypeNode =
  | NamedTypeNode
  | GenericTypeNode
  | ArrayTypeNode;

export interface NamedTypeNode {
  kind: "NamedTypeNode";
  name: string; // ex: "Int", "String"
  span?: Span;
}

export interface GenericTypeNode {
  kind: "GenericTypeNode";
  name: string; // ex: "Result"
  typeArguments: TypeNode[]; // ex: [NamedTypeNode("Int")]
  span?: Span;
}

export interface ArrayTypeNode {
  kind: "ArrayTypeNode";
  elementType: TypeNode; // ex: [Int] (Array de Int)
  span?: Span;
}

// --- Fim Tipagem ---

export interface AssignmentExpr {
  kind: "AssignmentExpr";
  assignee: Identifier | MemberExpr | IndexExpr; // Target of the assignment (e.g., Identifier or MemberExpr)
  value: Expr;
  span?: Span;
}

export interface StringInterpolationExpr {
  kind: "StringInterpolationExpr";
  parts: (string | Expr)[];
  span?: Span;
}

export interface LogicalExpr {
  kind: "LogicalExpr";
  left: Expr;
  operator: string;
  right: Expr;
  span?: Span;
}

export interface UnaryExpr {
  kind: "UnaryExpr";
  operator: string;
  argument: Expr;
  span?: Span;
}

export interface WhileStmt {
  kind: "WhileStmt";
  condition: Expr;
  body: BlockStmt;
  span?: Span;
}

export interface ArrayLiteral {
  kind: "ArrayLiteral";
  elements: Expr[];
  span?: Span;
}

export interface IndexExpr {
  kind: "IndexExpr";
  object: Expr;
  index: Expr;
  span?: Span;
}

export interface TraitDeclaration {
  kind: "TraitDeclaration";
  name: string;
  methods: {
    name: string;
    parameters: Parameter[];
    returnType?: TypeNode;
    span?: Span;
  }[];
  span?: Span;
}

export interface ImportDeclaration {
  kind: "ImportDeclaration";
  moduleName: string;
  imports: string[];
  span?: Span;
}

export interface ImplDeclaration {
  kind: "ImplDeclaration";
  structName: string;
  traitName?: string; // Opcional: só preenchido se for `impl Trait for Struct`
  methods: FunctionDeclaration[];
  span?: Span;
}

export interface StructDeclaration {
  kind: "StructDeclaration";
  name: string;
  properties: { name: string; typeAnnotation: TypeNode; span?: Span }[];
  span?: Span;
}

export interface StructExpr {
  kind: "StructExpr";
  structName: string;
  properties: { name: string; value: Expr; span?: Span }[];
  span?: Span;
}

export interface MemberExpr {
  kind: "MemberExpr";
  object: Expr; // A variável que guarda a struct (ex: p)
  property: string; // O nome da propriedade (ex: x)
  span?: Span;
}

export interface Parameter {
  name: string;
  typeAnnotation: TypeNode;
  isMut?: boolean;
  span?: Span;
}

export interface AttributeNode {
  kind: "Attribute";
  name: string;
  args?: Expr[];
  span?: Span;
}

export interface FunctionDeclaration {
  kind: "FunctionDeclaration";
  name: string;
  parameters: Parameter[];
  returnType?: TypeNode | undefined;
  body: BlockStmt;
  attributes?: AttributeNode[];
  span?: Span;
}

export interface ReturnStmt {
  kind: "ReturnStmt";
  value?: Expr | undefined;
  span?: Span;
}

export interface CallExpr {
  kind: "CallExpr";
  caller: Expr; // Geralmente Identifier para funções
  args: Expr[];
  span?: Span;
}

export interface BlockStmt {
  kind: "BlockStmt";
  body: Stmt[];
  span?: Span;
}

export interface IfStmt {
  kind: "IfStmt";
  condition: Expr;
  consequent: BlockStmt;
  alternate?: BlockStmt | IfStmt | undefined; // Suporta BlockStmt ou IfStmt recursivo para 'else if'
  span?: Span;
}

export interface BreakStmt {
  kind: "BreakStmt";
  span?: Span;
}

export interface ContinueStmt {
  kind: "ContinueStmt";
  span?: Span;
}

export interface ForStmt {
  kind: "ForStmt";
  iteratorName: string;
  indexName?: string | undefined;
  iterable: Expr;
  body: BlockStmt;
  span?: Span;
}

export interface VarDeclaration {
  kind: "VarDeclaration";
  name: string;
  value: Expr;
  typeAnnotation?: TypeNode | undefined;
  isMut: boolean;
  span?: Span;
}

export interface ConstDeclaration {
  kind: "ConstDeclaration";
  name: string;
  value: Expr;
  typeAnnotation?: TypeNode | undefined;
  span?: Span;
}

export interface PrintStmt {
  kind: "PrintStmt";
  value: Expr;
  span?: Span;
}

export interface BinaryExpr {
  kind: "BinaryExpr";
  left: Expr;
  operator: string;
  right: Expr;
  span?: Span;
}

export interface NumericLiteral {
  kind: "NumericLiteral";
  value: number;
  isFloat?: boolean;
  span?: Span;
}

export interface StringLiteral {
  kind: "StringLiteral";
  value: string;
  span?: Span;
}

export interface Identifier {
  kind: "Identifier";
  symbol: string;
  span?: Span;
}

// --- Enum e Pattern Matching ---

export interface EnumVariantDecl {
  name: string;
  payload?: TypeNode[];
  span?: Span;
}

export interface EnumDeclaration {
  kind: "EnumDeclaration";
  name: string;
  variants: EnumVariantDecl[];
  /**
   * Parâmetros de tipo do enum (ex: ["T", "E"] em `Result<T, E>`).
   * Só os enums embutidos têm — o parser não aceita generics de usuário.
   */
  typeParams?: string[];
  span?: Span;
}

export interface MatchArm {
  enumName: string;
  variantName: string;
  binders: string[]; // Variáveis para mapear o payload (ex: v em Ok(v))
  body: BlockStmt;
  span?: Span;
}

export interface MatchStmt {
  kind: "MatchStmt";
  value: Expr;
  arms: MatchArm[];
  span?: Span;
}

export interface ScopeStmt {
  kind: "ScopeStmt";
  deadline?: Expr; // Opcional, para timeout
  body: BlockStmt;
  span?: Span;
}

export interface SpawnStmt {
  kind: "SpawnStmt";
  body: BlockStmt;
  span?: Span;
}

export interface TryExpr {
  kind: "TryExpr";
  expression: Expr;
  span?: Span;
}

export interface LambdaExpr {
  kind: "LambdaExpr";
  parameters: Parameter[];
  body: BlockStmt;
  span?: Span;
}

export interface MapLiteral {
  kind: "MapLiteral";
  properties: { key: string; value: Expr; span?: Span }[];
  span?: Span;
}

export interface CatchExpr {
  kind: "CatchExpr";
  expression: Expr;
  errorBinder: string;
  body: BlockStmt;
  span?: Span;
}
