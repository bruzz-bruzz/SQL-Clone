import type { Database, QueryResult, Statement } from '../types/sql';
import { Tokenizer } from './tokenizer';
import { Parser } from './parser';
import { Executor } from './executor';

export { Tokenizer } from './tokenizer';
export { Parser } from './parser';
export { Executor } from './executor';

export function createDatabase(initial?: Database): Database {
  return initial ?? { tables: {} };
}

export function runQuery(db: Database, sql: string): QueryResult {
  const start = performance.now();
  try {
    const tokens = new Tokenizer(sql).tokenize();
    const statements: Statement[] = new Parser(tokens).parse();
    const executor = new Executor(db);
    const results = [];
    for (const stmt of statements) {
      const r = executor.execute(stmt);
      results.push(...r);
    }
    return {
      ok: true,
      results,
      executionTimeMs: performance.now() - start,
    };
  } catch (err: any) {
    return {
      ok: false,
      results: [],
      error: err?.message ?? String(err),
      executionTimeMs: performance.now() - start,
    };
  }
}