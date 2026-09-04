import type { Token } from './tokenizer';
import type {
  Statement, CreateTableStmt, InsertStmt, SelectStmt,
  UpdateStmt, DeleteStmt, DropTableStmt, ColumnDef, DataType,
  SelectColumn, TableRef, JoinClause, OrderByClause, Expr, BinaryOp, Value,
} from '../types/sql';

export class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): Statement[] {
    const statements: Statement[] = [];
    while (this.peek().type !== 'EOF') {
      this.skipSemi();
      if (this.peek().type === 'EOF') break;
      statements.push(this.parseStatement());
      this.skipSemi();
    }
    return statements;
  }

  private parseStatement(): Statement {
    const t = this.peek();
    if (t.type !== 'KEYWORD') {
      throw new Error(`Expected keyword, got '${t.value}' at position ${t.pos}`);
    }
    switch (t.value) {
      case 'SELECT': return this.parseSelect();
      case 'INSERT': return this.parseInsert();
      case 'UPDATE': return this.parseUpdate();
      case 'DELETE': return this.parseDelete();
      case 'CREATE': return this.parseCreate();
      case 'DROP': return this.parseDrop();
      default:
        throw new Error(`Unsupported statement: ${t.value}`);
    }
  }

  private parseCreate(): CreateTableStmt {
    this.expect('CREATE');
    this.expect('TABLE');
    if (this.peekIf('IF')) { this.advance(); this.expect('EXISTS'); }
    const table = this.expectIdent();
    this.expect('(');
    const columns: ColumnDef[] = [];
    do {
      const colName = this.expectIdent();
      let type: DataType = 'TEXT';
      if (this.peek().type === 'IDENT' || this.peek().type === 'KEYWORD') {
        if (this.isTypeKeyword(this.peek().value)) {
          type = this.parseTypeKeyword();
        }
      }
      let primaryKey = false;
      let notNull = false;
      while (this.peek().type === 'KEYWORD' && ['PRIMARY', 'NOT'].includes(this.peek().value)) {
        if (this.peek().value === 'PRIMARY') {
          this.advance();
          this.expect('KEY');
          primaryKey = true;
          notNull = true;
        } else {
          this.advance();
          this.expect('NULL');
          notNull = true;
        }
      }
      columns.push({ name: colName, type, primaryKey, notNull });
    } while (this.consume(','));
    this.expect(')');
    return { type: 'CREATE_TABLE', table, columns };
  }

  private parseTypeKeyword(): DataType {
    const t = this.advance();
    switch (t.value) {
      case 'INT':
      case 'INTEGER':
        return 'INT';
      case 'TEXT':
      case 'VARCHAR':
        return 'TEXT';
      case 'REAL':
      case 'FLOAT':
        return 'REAL';
      case 'BOOLEAN':
      case 'BOOL':
        return 'BOOLEAN';
      default:
        throw new Error(`Unknown type '${t.value}'`);
    }
  }

  private isTypeKeyword(value: string): boolean {
    return ['INT', 'INTEGER', 'TEXT', 'VARCHAR', 'REAL', 'FLOAT', 'BOOLEAN', 'BOOL'].includes(value);
  }

  private parseDrop(): DropTableStmt {
    this.expect('DROP');
    this.expect('TABLE');
    if (this.peekIf('IF')) { this.advance(); this.expect('EXISTS'); }
    const table = this.expectIdent();
    return { type: 'DROP_TABLE', table };
  }

  private parseInsert(): InsertStmt {
    this.expect('INSERT');
    this.expect('INTO');
    const table = this.expectIdent();
    let columns: string[] | undefined;
    if (this.consume('(')) {
      columns = [];
      do { columns.push(this.expectIdent()); } while (this.consume(','));
      this.expect(')');
    }
    this.expect('VALUES');
    const values: Value[][] = [];
    do {
      this.expect('(');
      const row: Value[] = [];
      do { row.push(this.parseLiteral()); } while (this.consume(','));
      this.expect(')');
      values.push(row);
    } while (this.consume(','));
    return { type: 'INSERT', table, columns, values };
  }

  private parseLiteral(): Value {
    const t = this.peek();
    if (t.type === 'NUMBER') { this.advance(); return Number(t.value); }
    if (t.type === 'STRING') { this.advance(); return t.value; }
    if (t.type === 'KEYWORD') {
      if (t.value === 'TRUE') { this.advance(); return true; }
      if (t.value === 'FALSE') { this.advance(); return false; }
      if (t.value === 'NULL') { this.advance(); return null; }
    }
    throw new Error(`Expected literal, got '${t.value}' at position ${t.pos}`);
  }

  private parseUpdate(): UpdateStmt {
    this.expect('UPDATE');
    const table = this.expectIdent();
    this.expect('SET');
    const set: { column: string; value: Expr }[] = [];
    do {
      const col = this.expectIdent();
      this.expect('=');
      set.push({ column: col, value: this.parseExpr() });
    } while (this.consume(','));
    let where: Expr | undefined;
    if (this.peekIf('WHERE')) { this.advance(); where = this.parseExpr(); }
    return { type: 'UPDATE', table, set, where };
  }

  private parseDelete(): DeleteStmt {
    this.expect('DELETE');
    this.expect('FROM');
    const table = this.expectIdent();
    let where: Expr | undefined;
    if (this.peekIf('WHERE')) { this.advance(); where = this.parseExpr(); }
    return { type: 'DELETE', table, where };
  }

  private parseSelect(): SelectStmt {
    this.expect('SELECT');
    let distinct = false;
    if (this.peekIf('DISTINCT')) { this.advance(); distinct = true; }
    const columns = this.parseSelectColumns();
    this.expect('FROM');
    const from = this.parseTableRefs();
    const joins: JoinClause[] = [];
    while (this.peek().type === 'KEYWORD' && ['INNER', 'LEFT', 'RIGHT', 'JOIN'].includes(this.peek().value)) {
      joins.push(this.parseJoin());
    }
    let where: Expr | undefined;
    if (this.peekIf('WHERE')) { this.advance(); where = this.parseExpr(); }
    let groupBy: Expr[] | undefined;
    if (this.peekIf('GROUP')) {
      this.advance(); this.expect('BY');
      groupBy = [this.parseExpr()];
      while (this.consume(',')) groupBy.push(this.parseExpr());
    }
    let having: Expr | undefined;
    if (this.peekIf('HAVING')) { this.advance(); having = this.parseExpr(); }
    let orderBy: OrderByClause[] | undefined;
    if (this.peekIf('ORDER')) {
      this.advance(); this.expect('BY');
      orderBy = [];
      do {
        const expr = this.parseExpr();
        let dir: 'ASC' | 'DESC' = 'ASC';
        if (this.peekIf('ASC')) { this.advance(); dir = 'ASC'; }
        else if (this.peekIf('DESC')) { this.advance(); dir = 'DESC'; }
        orderBy.push({ expr, direction: dir });
      } while (this.consume(','));
    }
    let limit: number | undefined;
    let offset: number | undefined;
    if (this.peekIf('LIMIT')) {
      this.advance();
      const t = this.peek();
      if (t.type !== 'NUMBER') throw new Error('Expected number after LIMIT');
      limit = Number(t.value);
      this.advance();
      if (this.peekIf('OFFSET')) {
        this.advance();
        const t2 = this.peek();
        if (t2.type !== 'NUMBER') throw new Error('Expected number after OFFSET');
        offset = Number(t2.value);
        this.advance();
      }
    }
    if (this.peekIf('OFFSET')) {
      this.advance();
      const t = this.peek();
      if (t.type !== 'NUMBER') throw new Error('Expected number after OFFSET');
      offset = Number(t.value);
      this.advance();
    }
    return { type: 'SELECT', distinct, columns, from, joins, where, groupBy, having, orderBy, limit, offset };
  }

  private parseSelectColumns(): SelectColumn[] {
    const cols: SelectColumn[] = [];
    do {
      if (this.peek().type === 'OPERATOR' && this.peek().value === '*') {
        this.advance();
        cols.push({ expr: { kind: 'star' } });
        continue;
      }
      // Qualified star: table.*
      if (this.peek().type === 'IDENT') {
        const savePos = this.pos;
        const tableName = this.advance().value;
        if (this.peek().type === 'OPERATOR' && this.peek().value === '.' && this.peek2()?.type === 'OPERATOR' && this.peek2()?.value === '*') {
          this.advance();
          this.advance();
          cols.push({ expr: { kind: 'star', table: tableName } });
          continue;
        }
        this.pos = savePos;
      }
      const expr = this.parseExpr();
      let alias: string | undefined;
      if (this.peekIf('AS')) {
        this.advance();
        alias = this.expectIdent();
      } else if (this.peek().type === 'IDENT' && !this.isClauseAhead()) {
        alias = this.advance().value;
      }
      cols.push({ expr, alias });
    } while (this.consume(','));
    return cols;
  }

  private parseTableRefs(): TableRef[] {
    const refs: TableRef[] = [];
    do {
      const name = this.expectIdent();
      let alias: string | undefined;
      if (this.peekIf('AS')) {
        this.advance();
        alias = this.expectIdent();
      } else if (this.peek().type === 'IDENT' && !this.isJoinAhead()) {
        alias = this.advance().value;
      }
      refs.push({ name, alias });
    } while (this.consume(','));
    return refs;
  }

  private isJoinAhead(): boolean {
    const t = this.peek();
    return t.type === 'KEYWORD' && ['INNER', 'LEFT', 'RIGHT', 'JOIN', 'WHERE', 'GROUP', 'HAVING', 'ORDER', 'LIMIT', 'OFFSET', 'ON'].includes(t.value);
  }

  private isClauseAhead(): boolean {
    const t = this.peek();
    return t.type === 'KEYWORD' && ['FROM', 'WHERE', 'GROUP', 'HAVING', 'ORDER', 'LIMIT', 'OFFSET', 'ON', 'INNER', 'LEFT', 'RIGHT', 'JOIN', 'AS'].includes(t.value);
  }

  private parseJoin(): JoinClause {
    let type: JoinClause['type'] = 'INNER';
    if (this.peekIf('INNER')) { this.advance(); this.expect('JOIN'); }
    else if (this.peekIf('LEFT')) { this.advance(); this.expect('JOIN'); type = 'LEFT'; }
    else if (this.peekIf('RIGHT')) { this.advance(); this.expect('JOIN'); type = 'RIGHT'; }
    else this.expect('JOIN');
    const name = this.expectIdent();
    let alias: string | undefined;
    if (this.peekIf('AS')) { this.advance(); alias = this.expectIdent(); }
    else if (this.peek().type === 'IDENT' && !this.peekIf('ON')) {
      alias = this.advance().value;
    }
    this.expect('ON');
    const on = this.parseExpr();
    return { type, table: { name, alias }, on };
  }

  // Expression parsing with precedence
  parseExpr(): Expr { return this.parseOr(); }

  private parseOr(): Expr {
    let left = this.parseAnd();
    while (this.peekIf('OR')) {
      this.advance();
      const right = this.parseAnd();
      left = { kind: 'binary', op: 'OR', left, right };
    }
    return left;
  }

  private parseAnd(): Expr {
    let left = this.parseNot();
    while (this.peekIf('AND')) {
      this.advance();
      const right = this.parseNot();
      left = { kind: 'binary', op: 'AND', left, right };
    }
    return left;
  }

  private parseNot(): Expr {
    if (this.peekIf('NOT')) {
      this.advance();
      return { kind: 'unary', op: 'NOT', operand: this.parseNot() };
    }
    return this.parseComparison();
  }

  private parseComparison(): Expr {
    let left = this.parseAdditive();
    while (true) {
      const t = this.peek();
      if (t.type === 'OPERATOR') {
        const opMap: Record<string, BinaryOp> = {
          '=': '=', '<>': '<>', '!=': '!=', '<': '<', '<=': '<=', '>': '>', '>=': '>=',
        };
        const op = opMap[t.value];
        if (op) {
          this.advance();
          const right = this.parseAdditive();
          left = { kind: 'binary', op, left, right };
          continue;
        }
      }
      if (t.type === 'KEYWORD') {
        if (t.value === 'LIKE') {
          this.advance();
          const right = this.parseAdditive();
          left = { kind: 'binary', op: 'LIKE', left, right };
          continue;
        }
        if (t.value === 'BETWEEN') {
          this.advance();
          const lower = this.parseAdditive();
          this.expect('AND');
          const upper = this.parseAdditive();
          left = { kind: 'between', expr: left, lower, upper };
          continue;
        }
        if (t.value === 'IN') {
          this.advance();
          this.expect('(');
          const list: Expr[] = [];
          do { list.push(this.parseLiteralOrExpr()); } while (this.consume(','));
          this.expect(')');
          left = { kind: 'in', expr: left, list };
          continue;
        }
        if (t.value === 'IS') {
          this.advance();
          const neg = this.peekIf('NOT');
          if (neg) this.advance();
          this.expect('NULL');
          left = { kind: 'isnull', expr: left, negated: neg };
          continue;
        }
      }
      break;
    }
    return left;
  }

  private parseAdditive(): Expr {
    let left = this.parseMultiplicative();
    while (this.peek().type === 'OPERATOR' && (this.peek().value === '+' || this.peek().value === '-')) {
      const op = this.advance().value as BinaryOp;
      const right = this.parseMultiplicative();
      left = { kind: 'binary', op, left, right };
    }
    return left;
  }

  private parseMultiplicative(): Expr {
    let left = this.parseUnary();
    while (this.peek().type === 'OPERATOR' && (this.peek().value === '*' || this.peek().value === '/')) {
      const op = this.advance().value as BinaryOp;
      const right = this.parseUnary();
      left = { kind: 'binary', op, left, right };
    }
    return left;
  }

  private parseUnary(): Expr {
    if (this.peek().type === 'OPERATOR' && this.peek().value === '-') {
      this.advance();
      return { kind: 'unary', op: '-', operand: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Expr {
    const t = this.peek();
    if (t.type === 'NUMBER') {
      this.advance();
      return { kind: 'literal', value: Number(t.value) };
    }
    if (t.type === 'STRING') {
      this.advance();
      return { kind: 'literal', value: t.value };
    }
    if (t.type === 'KEYWORD') {
      if (t.value === 'TRUE') { this.advance(); return { kind: 'literal', value: true }; }
      if (t.value === 'FALSE') { this.advance(); return { kind: 'literal', value: false }; }
      if (t.value === 'NULL') { this.advance(); return { kind: 'literal', value: null }; }
      if (['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'].includes(t.value)) {
        return this.parseFuncCall(t.value);
      }
    }
    if (t.type === 'IDENT') {
      const name = this.advance().value;
      if (this.peek().type === 'PUNCT' && this.peek().value === '(') {
        this.advance();
        const args: Expr[] = [];
        if (!(this.peek().type === 'PUNCT' && this.peek().value === ')')) {
          do {
            if (this.peek().type === 'OPERATOR' && this.peek().value === '*') {
              this.advance();
              args.push({ kind: 'star' });
              continue;
            }
            args.push(this.parseExpr());
          } while (this.consume(','));
        }
        this.expect(')');
        return { kind: 'func', name: name.toUpperCase(), args };
      }
      if (this.peek().type === 'PUNCT' && this.peek().value === '.') {
        this.advance();
        const col = this.advance().value;
        return { kind: 'column', table: name, name: col };
      }
      return { kind: 'column', name };
    }
    if (t.type === 'PUNCT' && t.value === '(') {
      this.advance();
      const inner = this.parseExpr();
      this.expect(')');
      return inner;
    }
    throw new Error(`Unexpected token '${t.value}' in expression at position ${t.pos}`);
  }

  private parseFuncCall(name: string): Expr {
    this.advance();
    this.expect('(');
    let distinct = false;
    if (this.peekIf('DISTINCT')) { this.advance(); distinct = true; }
    const args: Expr[] = [];
    if (!(this.peek().type === 'PUNCT' && this.peek().value === ')')) {
      do {
        if (this.peek().type === 'OPERATOR' && this.peek().value === '*') {
          this.advance();
          args.push({ kind: 'star' });
          continue;
        }
        args.push(this.parseExpr());
      } while (this.consume(','));
    }
    this.expect(')');
    return { kind: 'func', name, args, distinct };
  }

  private parseLiteralOrExpr(): Expr {
    const t = this.peek();
    if (t.type === 'NUMBER') { this.advance(); return { kind: 'literal', value: Number(t.value) }; }
    if (t.type === 'STRING') { this.advance(); return { kind: 'literal', value: t.value }; }
    if (t.type === 'KEYWORD') {
      if (t.value === 'TRUE') { this.advance(); return { kind: 'literal', value: true }; }
      if (t.value === 'FALSE') { this.advance(); return { kind: 'literal', value: false }; }
      if (t.value === 'NULL') { this.advance(); return { kind: 'literal', value: null }; }
    }
    return this.parseExpr();
  }

  // Token helpers
  private peek(): Token { return this.tokens[this.pos]; }
  private peek2(): Token { return this.tokens[this.pos + 1] || this.tokens[this.tokens.length - 1]; }
  private peekIf(value: string): boolean {
    const t = this.peek();
    return (t.type === 'KEYWORD' || t.type === 'IDENT' || t.type === 'OPERATOR' || t.type === 'PUNCT') && t.value === value;
  }
  private advance(): Token { return this.tokens[this.pos++]; }
  private expect(value: string): Token {
    const t = this.peek();
    if ((t.type === 'KEYWORD' || t.type === 'IDENT' || t.type === 'OPERATOR' || t.type === 'PUNCT') && t.value === value) {
      this.advance();
      return t;
    }
    throw new Error(`Expected '${value}' but got '${t.value}' at position ${t.pos}`);
  }
  private expectIdent(): string {
    const t = this.peek();
    if (t.type === 'IDENT' || (t.type === 'KEYWORD' && !['TRUE', 'FALSE', 'NULL'].includes(t.value))) {
      this.advance();
      return t.value;
    }
    throw new Error(`Expected identifier, got '${t.value}' at position ${t.pos}`);
  }
  private consume(value: string): boolean {
    if (this.peekIf(value)) { this.advance(); return true; }
    return false;
  }
  private skipSemi(): void {
    while (this.consume(';')) { /* skip */ }
  }
}