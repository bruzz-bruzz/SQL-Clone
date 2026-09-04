// Core types for the SQL engine

export type DataType = 'INT' | 'TEXT' | 'REAL' | 'BOOLEAN' | 'NULL';

export interface ColumnDef {
  name: string;
  type: DataType;
  primaryKey?: boolean;
  notNull?: boolean;
}

export interface TableSchema {
  name: string;
  columns: ColumnDef[];
}

export type Value = string | number | boolean | null;

export type Row = Record<string, Value>;

export interface Database {
  tables: Record<string, {
    schema: TableSchema;
    rows: Row[];
  }>;
}

// AST types
export interface CreateTableStmt {
  type: 'CREATE_TABLE';
  table: string;
  columns: ColumnDef[];
}

export interface InsertStmt {
  type: 'INSERT';
  table: string;
  columns?: string[];
  values: Value[][];
  /** If set, the result is the projected columns of each inserted row.
   *  When the array contains exactly one entry of kind `star`, all columns
   *  of the target table are returned. */
  returning?: ReturningItem[];
}

export interface SelectStmt {
  type: 'SELECT';
  distinct?: boolean;
  columns: SelectColumn[];
  from: TableRef[];
  joins?: JoinClause[];
  where?: Expr;
  groupBy?: Expr[];
  having?: Expr;
  orderBy?: OrderByClause[];
  offset?: number;
  limit?: number;
}

export interface SelectColumn {
  expr: Expr;
  alias?: string;
}

export interface TableRef {
  name: string;
  alias?: string;
}

export interface JoinClause {
  type: 'INNER' | 'LEFT' | 'RIGHT';
  table: TableRef;
  on: Expr;
}

export interface OrderByClause {
  expr: Expr;
  direction: 'ASC' | 'DESC';
}

export interface UpdateStmt {
  type: 'UPDATE';
  table: string;
  set: { column: string; value: Expr }[];
  where?: Expr;
  returning?: ReturningItem[];
}

export interface DeleteStmt {
  type: 'DELETE';
  table: string;
  where?: Expr;
  returning?: ReturningItem[];
}

/** One item in a RETURNING clause — either `*` (all columns) or an expression
 *  with an optional alias. */
export interface ReturningItem {
  expr: Expr;
  alias?: string;
}

export interface DropTableStmt {
  type: 'DROP_TABLE';
  table: string;
}

export type Statement =
  | CreateTableStmt
  | InsertStmt
  | SelectStmt
  | UpdateStmt
  | DeleteStmt
  | DropTableStmt;

// Expressions
export interface ColumnRef {
  kind: 'column';
  table?: string;
  name: string;
}

export interface LiteralExpr {
  kind: 'literal';
  value: Value;
}

export interface StarExpr {
  kind: 'star';
  table?: string;
}

export interface BinaryExpr {
  kind: 'binary';
  op: BinaryOp;
  left: Expr;
  right: Expr;
}

export interface UnaryExpr {
  kind: 'unary';
  op: 'NOT' | '-';
  operand: Expr;
}

export interface FuncCall {
  kind: 'func';
  name: string; // COUNT, SUM, AVG, MIN, MAX
  args: Expr[];
  distinct?: boolean;
}

export interface BetweenExpr {
  kind: 'between';
  expr: Expr;
  lower: Expr;
  upper: Expr;
  negated?: boolean;
}

export interface InExpr {
  kind: 'in';
  expr: Expr;
  list: Expr[];
  negated?: boolean;
}

export interface IsNullExpr {
  kind: 'isnull';
  expr: Expr;
  negated?: boolean;
}

export interface CaseWhen {
  condition: Expr;
  result: Expr;
}

/** CASE expression.
 *  Two forms are supported:
 *    - Simple: `CASE operand WHEN value THEN result [...] [ELSE default] END`
 *    - Searched: `CASE WHEN condition THEN result [...] [ELSE default] END`
 *  `operand` is set for the simple form, undefined for the searched form. */
export interface CaseExpr {
  kind: 'case';
  operand?: Expr;
  whens: CaseWhen[];
  else?: Expr;
}

export type Expr =
  | ColumnRef
  | LiteralExpr
  | StarExpr
  | BinaryExpr
  | UnaryExpr
  | FuncCall
  | BetweenExpr
  | InExpr
  | IsNullExpr
  | CaseExpr;

export type BinaryOp =
  | '=' | '<>' | '!=' | '<' | '<=' | '>' | '>='
  | '+' | '-' | '*' | '/'
  | 'AND' | 'OR' | 'LIKE';

// Result types
export interface ResultSet {
  columns: string[];
  rows: Value[][];
  affectedRows?: number;
  message?: string;
}

export interface QueryResult {
  ok: boolean;
  results: ResultSet[];
  error?: string;
  /** Character position in the source SQL where the error originated (0-based). */
  errorPos?: number;
  executionTimeMs: number;
}