import type {
  Database, Statement, SelectStmt, InsertStmt, UpdateStmt, DeleteStmt,
  CreateTableStmt, DropTableStmt, Expr, Row, Value, ColumnRef,
  ResultSet, TableRef, JoinClause,
} from '../types/sql';

interface RowContext {
  // source name -> Row
  [source: string]: any;
}

export class Executor {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  execute(stmt: Statement): ResultSet[] {
    switch (stmt.type) {
      case 'CREATE_TABLE': return [this.execCreateTable(stmt)];
      case 'DROP_TABLE': return [this.execDropTable(stmt)];
      case 'INSERT': return [this.execInsert(stmt)];
      case 'UPDATE': return [this.execUpdate(stmt)];
      case 'DELETE': return [this.execDelete(stmt)];
      case 'SELECT': return this.execSelect(stmt);
    }
  }

  private execCreateTable(stmt: CreateTableStmt): ResultSet {
    if (this.db.tables[stmt.table]) {
      throw new Error(`Table '${stmt.table}' already exists`);
    }
    this.db.tables[stmt.table] = { schema: { name: stmt.table, columns: stmt.columns }, rows: [] };
    return { columns: ['status'], rows: [['Table created']], message: `Table '${stmt.table}' created` };
  }

  private execDropTable(stmt: DropTableStmt): ResultSet {
    if (!this.db.tables[stmt.table]) {
      throw new Error(`Table '${stmt.table}' does not exist`);
    }
    delete this.db.tables[stmt.table];
    return { columns: ['status'], rows: [['Table dropped']], message: `Table '${stmt.table}' dropped` };
  }

  private execInsert(stmt: InsertStmt): ResultSet {
    const tbl = this.db.tables[stmt.table];
    if (!tbl) throw new Error(`Table '${stmt.table}' does not exist`);
    const cols = stmt.columns ?? tbl.schema.columns.map(c => c.name);
    for (const name of cols) {
      if (!tbl.schema.columns.find(c => c.name === name)) {
        throw new Error(`Unknown column '${name}' in INSERT`);
      }
    }
    let inserted = 0;
    for (const rowValues of stmt.values) {
      if (rowValues.length !== cols.length) {
        throw new Error(`Column count mismatch in INSERT: got ${rowValues.length}, expected ${cols.length}`);
      }
      const row: Row = {};
      for (let i = 0; i < cols.length; i++) {
        const colDef = tbl.schema.columns.find(c => c.name === cols[i])!;
        let v = this.coerce(rowValues[i], colDef.type);
        if (colDef.notNull && v === null) {
          throw new Error(`Column '${colDef.name}' cannot be NULL`);
        }
        row[colDef.name] = v;
      }
      const pk = tbl.schema.columns.find(c => c.primaryKey);
      if (pk) {
        const pkVal = row[pk.name];
        if (tbl.rows.some(r => r[pk.name] === pkVal)) {
          throw new Error(`Duplicate primary key value '${pkVal}' for ${pk.name}`);
        }
      }
      tbl.rows.push(row);
      inserted++;
    }
    return {
      columns: ['affected_rows'],
      rows: [[inserted]],
      affectedRows: inserted,
      message: `${inserted} row(s) inserted`,
    };
  }

  private coerce(v: Value, type: string): Value {
    if (v === null) return null;
    switch (type) {
      case 'INT':
        return typeof v === 'number' ? Math.trunc(v) : parseInt(String(v), 10);
      case 'REAL':
        return typeof v === 'number' ? v : parseFloat(String(v));
      case 'BOOLEAN':
        if (typeof v === 'boolean') return v;
        if (typeof v === 'number') return v !== 0;
        const s = String(v).toLowerCase();
        if (s === 'true' || s === '1') return true;
        if (s === 'false' || s === '0') return false;
        return Boolean(v);
      case 'TEXT':
        return String(v);
      default:
        return v;
    }
  }

  private execUpdate(stmt: UpdateStmt): ResultSet {
    const tbl = this.db.tables[stmt.table];
    if (!tbl) throw new Error(`Table '${stmt.table}' does not exist`);
    let updated = 0;
    for (const row of tbl.rows) {
      const ctx: RowContext = { [stmt.table]: row };
      if (stmt.where && !this.evalBool(stmt.where, ctx)) continue;
      for (const { column, value } of stmt.set) {
        const colDef = tbl.schema.columns.find(c => c.name === column);
        if (!colDef) throw new Error(`Unknown column '${column}' in UPDATE`);
        let newVal = this.evalValue(value, ctx);
        if (colDef.notNull && newVal === null) {
          throw new Error(`Column '${colDef.name}' cannot be NULL`);
        }
        newVal = this.coerce(newVal, colDef.type);
        row[column] = newVal;
      }
      updated++;
    }
    return { columns: ['affected_rows'], rows: [[updated]], affectedRows: updated, message: `${updated} row(s) updated` };
  }

  private execDelete(stmt: DeleteStmt): ResultSet {
    const tbl = this.db.tables[stmt.table];
    if (!tbl) throw new Error(`Table '${stmt.table}' does not exist`);
    let deleted = 0;
    const remaining: Row[] = [];
    for (const row of tbl.rows) {
      const ctx: RowContext = { [stmt.table]: row };
      if (stmt.where && !this.evalBool(stmt.where, ctx)) {
        remaining.push(row);
      } else {
        deleted++;
      }
    }
    tbl.rows = remaining;
    return { columns: ['affected_rows'], rows: [[deleted]], affectedRows: deleted, message: `${deleted} row(s) deleted` };
  }

  private execSelect(stmt: SelectStmt): ResultSet[] {
    const sources: { key: string; schema: any }[] = [];
    let cartesian: RowContext[] = [{}];
    for (const ref of stmt.from) {
      const src = this.getTableSource(ref);
      sources.push({ key: src.key, schema: src.schema });
      const newCart: RowContext[] = [];
      for (const ctx of cartesian) {
        for (const row of src.rows) {
          newCart.push({ ...ctx, [src.key]: row });
        }
      }
      cartesian = newCart;
    }
    for (const join of stmt.joins || []) {
      const src = this.getTableSource(join.table);
      sources.push({ key: src.key, schema: src.schema });
      const newCart: RowContext[] = [];
      for (const ctx of cartesian) {
        let matched = false;
        for (const row of src.rows) {
          const joined = { ...ctx, [src.key]: row };
          if (this.evalBool(join.on, joined)) {
            newCart.push(joined);
            matched = true;
          }
        }
        if (!matched && join.type === 'LEFT') {
          const nullRow: Row = {};
          for (const c of src.schema.columns) nullRow[c.name] = null;
          newCart.push({ ...ctx, [src.key]: nullRow });
        }
      }
      cartesian = newCart;
    }

    let rows = cartesian;
    if (stmt.where) rows = rows.filter(r => this.evalBool(stmt.where!, r));

    if (stmt.groupBy && stmt.groupBy.length > 0) {
      const groups = new Map<string, RowContext[]>();
      const order: string[] = [];
      for (const r of rows) {
        const key = stmt.groupBy.map(g => JSON.stringify(this.evalValue(g, r))).join('|');
        if (!groups.has(key)) { groups.set(key, []); order.push(key); }
        groups.get(key)!.push(r);
      }
      const outRows: RowContext[] = [];
      for (const k of order) {
        const grp = groups.get(k)!;
        outRows.push({ ...grp[0], __groupRows: grp } as RowContext);
      }
      let out = outRows;
      if (stmt.having) out = out.filter(r => this.evalBool(stmt.having!, r));
      this.applyOrderBy(out, stmt.orderBy);
      if (stmt.offset) out = out.slice(stmt.offset);
      if (stmt.limit !== undefined) out = out.slice(0, stmt.limit);
      const rs = this.project(out, stmt.columns, sources);
      if (stmt.distinct) this.applyDistinct(rs);
      return [rs];
    }

    // No explicit GROUP BY: if any aggregate is used, treat all rows as one group.
    if (this.hasAggregate(stmt.columns)) {
      const baseRow: RowContext = rows[0] ?? {};
      const grouped: RowContext = { ...baseRow, __groupRows: rows } as RowContext;
      let out: RowContext[] = [grouped];
      this.applyOrderBy(out, stmt.orderBy);
      if (stmt.offset) out = out.slice(stmt.offset);
      if (stmt.limit !== undefined) out = out.slice(0, stmt.limit);
      const rs = this.project(out, stmt.columns, sources);
      if (stmt.distinct) this.applyDistinct(rs);
      return [rs];
    }

    let out = rows;
    this.applyOrderBy(out, stmt.orderBy);
    if (stmt.offset) out = out.slice(stmt.offset);
    if (stmt.limit !== undefined) out = out.slice(0, stmt.limit);
    const rs = this.project(out, stmt.columns, sources);
    if (stmt.distinct) this.applyDistinct(rs);
    return [rs];
  }

  private applyDistinct(rs: ResultSet): void {
    const seen = new Set<string>();
    const unique: Value[][] = [];
    for (const row of rs.rows) {
      const key = row.map(v => (v === null ? ' NULL ' : JSON.stringify(v))).join('|');
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(row);
      }
    }
    rs.rows = unique;
  }

  private hasAggregate(cols: { expr: Expr }[]): boolean {
    for (const c of cols) {
      if (this.exprHasAggregate(c.expr)) return true;
    }
    return false;
  }

  private exprHasAggregate(e: Expr): boolean {
    if (e.kind === 'func') {
      const name = (e as any).name as string;
      if (['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'].includes(name)) return true;
      for (const a of e.args) if (this.exprHasAggregate(a)) return true;
    }
    if (e.kind === 'binary' && (e as any).op) {
      const b = e as any;
      if (this.exprHasAggregate(b.left) || this.exprHasAggregate(b.right)) return true;
    }
    return false;
  }

  private getTableSource(table: TableRef): { key: string; alias?: string; schema: any; rows: Row[] } {
    const name = table.name;
    if (!this.db.tables[name]) throw new Error(`Table '${name}' does not exist`);
    const tbl = this.db.tables[name];
    const key = table.alias ?? name;
    return { key, alias: table.alias, schema: tbl.schema, rows: tbl.rows };
  }

  private applyOrderBy(rows: RowContext[], orderBy?: { expr: Expr; direction: 'ASC' | 'DESC' }[]) {
    if (!orderBy || orderBy.length === 0) return;
    rows.sort((a, b) => {
      for (const { expr, direction } of orderBy) {
        const va = this.evalValue(expr, a);
        const vb = this.evalValue(expr, b);
        const cmp = this.compare(va, vb);
        if (cmp !== 0) return direction === 'ASC' ? cmp : -cmp;
      }
      return 0;
    });
  }

  private compare(a: Value, b: Value): number {
    if (a === null && b === null) return 0;
    if (a === null) return -1;
    if (b === null) return 1;
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    if (typeof a === 'boolean' && typeof b === 'boolean') return (a ? 1 : 0) - (b ? 1 : 0);
    return String(a).localeCompare(String(b));
  }

  private project(rows: RowContext[], cols: { expr: Expr; alias?: string }[], sources: { key: string; schema: any }[]): ResultSet {
    const headers: string[] = [];
    const expanders: ((ctx: RowContext) => Value[])[] = [];
    for (const c of cols) {
      if (c.expr.kind === 'star') {
        const exprTable = (c.expr as any).table as string | undefined;
        for (const src of sources) {
          if (exprTable && src.key !== exprTable) continue;
          for (const col of src.schema.columns) {
            headers.push(`${src.key}.${col.name}`);
            const key = src.key;
            const cname = col.name;
            expanders.push(ctx => [ctx[key] ? (ctx[key][cname] ?? null) : null]);
          }
        }
        continue;
      }
      if (c.alias) headers.push(c.alias);
      else headers.push(this.exprToString(c.expr));
      expanders.push(ctx => [this.evalValue(c.expr, ctx)]);
    }
    const out: Value[][] = [];
    for (const ctx of rows) {
      const row: Value[] = [];
      for (const ex of expanders) row.push(...ex(ctx));
      out.push(row);
    }
    return { columns: headers, rows: out };
  }

  private exprToString(expr: Expr): string {
    switch (expr.kind) {
      case 'literal': return String(expr.value);
      case 'column': return expr.table ? `${expr.table}.${expr.name}` : expr.name;
      case 'star': return '*';
      case 'binary': return `${this.exprToString(expr.left)} ${expr.op} ${this.exprToString(expr.right)}`;
      case 'unary': return `${expr.op} ${this.exprToString(expr.operand)}`;
      case 'func': return `${expr.name}(${expr.args.map(a => this.exprToString(a)).join(', ')})`;
      case 'between': return `${this.exprToString(expr.expr)} BETWEEN ${this.exprToString(expr.lower)} AND ${this.exprToString(expr.upper)}`;
      case 'in': return `${this.exprToString(expr.expr)} IN (...)`;
      case 'isnull': return `${this.exprToString(expr.expr)} IS ${expr.negated ? 'NOT ' : ''}NULL`;
    }
  }

  // SELECT execution support methods follow.

  private evalBool(expr: Expr, ctx: RowContext): boolean {
    return Boolean(this.evalValue(expr, ctx));
  }

  private evalValue(expr: Expr, ctx: RowContext): Value {
    switch (expr.kind) {
      case 'literal': return expr.value;
      case 'column': return this.resolveColumn(expr.name, expr.table, ctx);
      case 'star': return null;
      case 'binary': return this.evalBinary(expr, ctx);
      case 'unary': return this.evalUnary(expr, ctx);
      case 'func': return this.evalFunc(expr, ctx);
      case 'between': return this.evalBetween(expr, ctx);
      case 'in': return this.evalIn(expr, ctx);
      case 'isnull': return this.evalIsNull(expr, ctx);
    }
  }

  private resolveColumn(name: string, table: string | undefined, ctx: RowContext): Value {
    if (table) {
      if (ctx[table] === undefined) throw new Error(`Unknown source '${table}'`);
      const r = ctx[table] as Row;
      return name in r ? r[name] : null;
    }
    for (const key of Object.keys(ctx)) {
      if (key === '__groupRows') continue;
      const val = ctx[key];
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        const r = val as Row;
        if (name in r) return r[name];
      }
    }
    return null;
  }

  private evalBinary(expr: any, ctx: RowContext): Value {
    const op = expr.op as string;
    if (op === 'AND') return this.evalBool(expr.left, ctx) && this.evalBool(expr.right, ctx);
    if (op === 'OR') return this.evalBool(expr.left, ctx) || this.evalBool(expr.right, ctx);
    const l = this.evalValue(expr.left, ctx);
    const r = this.evalValue(expr.right, ctx);
    switch (op) {
      case '=': return this.cmpEq(l, r);
      case '<>':
      case '!=': return !this.cmpEq(l, r);
      case '<': return this.cmpNum(l, r) < 0;
      case '<=': return this.cmpNum(l, r) <= 0;
      case '>': return this.cmpNum(l, r) > 0;
      case '>=': return this.cmpNum(l, r) >= 0;
      case '+': return this.arith(l, r, (a, b) => a + b);
      case '-': return this.arith(l, r, (a, b) => a - b);
      case '*': return this.arith(l, r, (a, b) => a * b);
      case '/': return this.arith(l, r, (a, b) => a / b);
      case 'LIKE': return this.evalLike(l, r);
    }
    return null;
  }

  private cmpEq(a: Value, b: Value): boolean {
    if (a === null || b === null) return a === b;
    return a === b;
  }

  private cmpNum(a: Value, b: Value): number {
    if (a === null || b === null) return 0;
    const na = Number(a);
    const nb = Number(b);
    if (isNaN(na) || isNaN(nb)) {
      const sa = String(a);
      const sb = String(b);
      return sa < sb ? -1 : sa > sb ? 1 : 0;
    }
    return na - nb;
  }

  private arith(a: Value, b: Value, op: (x: number, y: number) => number): Value {
    if (a === null || b === null) return null;
    return op(Number(a), Number(b));
  }

  private evalLike(a: Value, b: Value): boolean {
    if (a === null || b === null) return false;
    const pattern = String(b)
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/%/g, '.*')
      .replace(/_/g, '.');
    const re = new RegExp(`^${pattern}$`, 'i');
    return re.test(String(a));
  }

  private evalUnary(expr: any, ctx: RowContext): Value {
    if (expr.op === 'NOT') return !this.evalBool(expr.operand, ctx);
    if (expr.op === '-') {
      const v = this.evalValue(expr.operand, ctx);
      return v === null ? null : -Number(v);
    }
    return this.evalValue(expr.operand, ctx);
  }

  private evalBetween(expr: any, ctx: RowContext): boolean {
    const v = this.evalValue(expr.expr, ctx);
    const lo = this.evalValue(expr.lower, ctx);
    const hi = this.evalValue(expr.upper, ctx);
    if (v === null || lo === null || hi === null) return false;
    const result = this.cmpNum(v, lo) >= 0 && this.cmpNum(v, hi) <= 0;
    return expr.negated ? !result : result;
  }

  private evalIn(expr: any, ctx: RowContext): boolean {
    const v = this.evalValue(expr.expr, ctx);
    for (const item of expr.list) {
      const iv = this.evalValue(item, ctx);
      if (this.cmpEq(v, iv)) return !expr.negated;
    }
    return expr.negated ? true : false;
  }

  private evalIsNull(expr: any, ctx: RowContext): boolean {
    const v = this.evalValue(expr.expr, ctx);
    const isNull = v === null;
    return expr.negated ? !isNull : isNull;
  }

  private evalFunc(expr: any, ctx: RowContext): Value {
    const name = expr.name as string;
    if (name === 'COUNT') {
      if (expr.args.length === 1 && expr.args[0].kind === 'star') {
        const grp = ctx.__groupRows as RowContext[] | undefined;
        if (grp) return grp.length;
        return 1;
      }
      const grp = ctx.__groupRows as RowContext[] | undefined;
      const target = grp ?? [ctx];
      const set = expr.distinct ? new Set<string>() : null;
      let count = 0;
      for (const r of target) {
        const v = this.evalValue(expr.args[0], r);
        if (v === null) continue;
        if (set) {
          const k = JSON.stringify(v);
          if (set.has(k)) continue;
          set.add(k);
        }
        count++;
      }
      return count;
    }
    if (['SUM', 'AVG', 'MIN', 'MAX'].includes(name)) {
      const grp = ctx.__groupRows as RowContext[] | undefined;
      const target = grp ?? [ctx];
      const vals: number[] = [];
      for (const r of target) {
        const v = this.evalValue(expr.args[0], r);
        if (v === null) continue;
        vals.push(Number(v));
      }
      if (vals.length === 0) return null;
      if (name === 'SUM') return vals.reduce((a, b) => a + b, 0);
      if (name === 'AVG') return vals.reduce((a, b) => a + b, 0) / vals.length;
      if (name === 'MIN') return Math.min(...vals);
      if (name === 'MAX') return Math.max(...vals);
    }
    throw new Error(`Unknown function ${name}`);
  }
}