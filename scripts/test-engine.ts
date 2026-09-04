// Standalone test of the SQL engine using Node 22+ experimental TS strip.
// Usage:  node --experimental-strip-types scripts/test-engine.ts
//
// But imports use .ts extension and the src files reference .ts extensions too,
// so we need a TypeScript-aware loader. Use tsx:

import { runQuery } from '../src/engine/index.ts';
import { createSampleDatabase } from '../src/utils/samples.ts';
import type { Database } from '../src/types/sql.ts';

const db: Database = createSampleDatabase();

function showResult(label: string, sql: string) {
  console.log('─'.repeat(70));
  console.log(`▶ ${label}`);
  console.log(`SQL: ${sql.replace(/\n/g, ' ')}`);
  const fresh = JSON.parse(JSON.stringify(db)) as Database;
  const r = runQuery(fresh, sql);
  if (!r.ok) {
    console.log(`✗ ERROR: ${r.error}${typeof r.errorPos === 'number' ? `  (at pos ${r.errorPos})` : ''}`);
    return;
  }
  for (const rs of r.results) {
    if (rs.message) console.log(`  msg: ${rs.message}`);
    if (rs.columns.length === 1 && rs.columns[0] === 'affected_rows') {
      console.log(`  affected: ${rs.rows[0]?.[0]}`);
      continue;
    }
    if (rs.rows.length === 0) { console.log('  (no rows)'); continue; }
    console.log('  ' + rs.columns.join(' | '));
    for (const row of rs.rows) {
      console.log('  ' + row.map(v => v === null ? 'NULL' : String(v)).join(' | '));
    }
  }
}

const failures: string[] = [];
function assert(cond: unknown, label: string) {
  if (cond) {
    console.log(`  ✓ ${label}`);
  } else {
    console.log(`  ✗ ${label}`);
    failures.push(label);
  }
}

function eqArr<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false;
  return true;
}

function showAsserts(label: string, sql: string, checks: ((r: ReturnType<typeof runQuery>) => void)[]) {
  console.log('─'.repeat(70));
  console.log(`▶ ${label}`);
  console.log(`SQL: ${sql.replace(/\n/g, ' ')}`);
  const fresh = JSON.parse(JSON.stringify(db)) as Database;
  const r = runQuery(fresh, sql);
  if (!r.ok) {
    console.log(`✗ ERROR: ${r.error}${typeof r.errorPos === 'number' ? `  (at pos ${r.errorPos})` : ''}`);
    return;
  }
  for (const rs of r.results) {
    if (rs.message) console.log(`  msg: ${rs.message}`);
    if (rs.rows.length === 0) console.log('  (no rows)');
    else {
      console.log('  ' + rs.columns.join(' | '));
      for (const row of rs.rows) {
        console.log('  ' + row.map(v => v === null ? 'NULL' : String(v)).join(' | '));
      }
    }
  }
  for (const c of checks) c(r);
}

console.log('\n=== SQL ENGINE TESTS ===\n');

showResult('CREATE + INSERT', `CREATE TABLE products (id INT PRIMARY KEY, name TEXT, price REAL);
INSERT INTO products VALUES (1, 'Apple', 1.5), (2, 'Banana', 0.5), (3, 'Cherry', 3.0);
SELECT * FROM products;`);

showResult('SELECT all employees', `SELECT * FROM employees;`);
showResult('WHERE filter', `SELECT name, salary FROM employees WHERE salary > 75000 ORDER BY salary DESC;`);
showResult('GROUP BY', `SELECT department_id, COUNT(*) AS n, AVG(salary) AS avg_sal FROM employees GROUP BY department_id;`);
showResult('HAVING', `SELECT department_id, COUNT(*) AS n FROM employees GROUP BY department_id HAVING COUNT(*) >= 2;`);
showResult('INNER JOIN', `SELECT e.name, d.name AS dept FROM employees e INNER JOIN departments d ON e.department_id = d.id;`);
showResult('LEFT JOIN', `SELECT d.name, COUNT(e.id) AS emp_count FROM departments d LEFT JOIN employees e ON e.department_id = d.id GROUP BY d.id, d.name;`);
showResult('LIKE', `SELECT name FROM employees WHERE name LIKE 'A%' OR name LIKE '%k';`);
showResult('IN list', `SELECT name FROM employees WHERE department_id IN (1, 3);`);
showResult('BETWEEN', `SELECT name, salary FROM employees WHERE salary BETWEEN 70000 AND 90000;`);
showResult('IS NULL', `SELECT name FROM employees WHERE salary IS NULL;`);
showResult('AND/OR/NOT', `SELECT name FROM employees WHERE NOT (department_id = 2) AND salary > 60000;`);
showResult('DISTINCT', `SELECT DISTINCT department_id FROM employees;`);
showResult('LIMIT/OFFSET', `SELECT name FROM employees LIMIT 2 OFFSET 1;`);
showResult('Arithmetic + alias', `SELECT name, salary * 12 AS annual FROM employees;`);
showResult('UPDATE', `UPDATE employees SET salary = salary + 1000 WHERE id = 1; SELECT * FROM employees WHERE id = 1;`);
showResult('DELETE', `DELETE FROM employees WHERE id = 4; SELECT COUNT(*) AS cnt FROM employees;`);
showResult('COUNT(DISTINCT)', `SELECT COUNT(DISTINCT department_id) AS depts FROM employees;`);
showResult('Multi-statement', `CREATE TABLE a (x INT); INSERT INTO a VALUES (1),(2),(3); SELECT COUNT(*) FROM a;`);
showResult('Syntax error', `SELECT * FROM nope;`);
showResult('DROP TABLE', `CREATE TABLE tmp (x INT); DROP TABLE tmp; SELECT * FROM tmp;`);

// ---- RETURNING tests ----
console.log('\n=== RETURNING TESTS ===\n');

showAsserts(
  'INSERT ... RETURNING * (single row)',
  `INSERT INTO employees (id, name, department_id, salary, active) VALUES (10, 'Heidi', 1, 95000, TRUE) RETURNING *;`,
  [r => {
    const rs = r.results[0];
    assert(rs && rs.columns.length === 5, 'has 5 columns');
    assert(rs && rs.rows.length === 1, 'has 1 row');
    assert(rs && rs.rows[0][0] === 10, 'id = 10');
    assert(rs && rs.rows[0][1] === 'Heidi', 'name = Heidi');
  }],
);

showAsserts(
  'INSERT ... RETURNING specific columns + alias',
  `INSERT INTO employees (id, name, salary) VALUES (11, 'Ivan', 77000) RETURNING id, name, salary * 12 AS annual;`,
  [r => {
    const rs = r.results[0];
    assert(rs && eqArr(rs.columns, ['id', 'name', 'annual']), `columns = [id, name, annual] (got ${JSON.stringify(rs?.columns)})`);
    assert(rs && rs.rows.length === 1, '1 row');
    assert(rs && rs.rows[0][2] === 77000 * 12, 'annual = 924000');
  }],
);

showAsserts(
  'INSERT ... RETURNING (multi-row)',
  `INSERT INTO employees (id, name, department_id, salary, active) VALUES (12, 'Judy', 2, 65000, TRUE), (13, 'Karl', 2, 68000, TRUE) RETURNING id, name;`,
  [r => {
    const rs = r.results[0];
    assert(rs && rs.rows.length === 2, '2 rows returned');
    assert(rs && eqArr(rs.rows[0], [12, 'Judy']), 'row 1 = (12, Judy)');
    assert(rs && eqArr(rs.rows[1], [13, 'Karl']), 'row 2 = (13, Karl)');
  }],
);

showAsserts(
  'UPDATE ... RETURNING (new values + filter)',
  `UPDATE employees SET salary = salary + 5000 WHERE department_id = 3 RETURNING id, name, salary;`,
  [r => {
    const rs = r.results[0];
    assert(rs && rs.rows.length >= 1, 'at least 1 row returned');
    for (const row of rs.rows) {
      assert((row[2] as number) >= 65000, `Eve-class row has new salary >= 65000 (got ${row[2]})`);
    }
  }],
);

showAsserts(
  'DELETE ... RETURNING *',
  `DELETE FROM employees WHERE id = 5 RETURNING *;`,
  [r => {
    const rs = r.results[0];
    assert(rs && rs.rows.length === 1, '1 row returned');
    assert(rs && rs.rows[0][0] === 5, 'deleted id = 5');
    assert(rs && rs.rows[0][1] === 'Eve', 'deleted name = Eve');
  }],
);

// ---- Error position tests ----
console.log('\n=== ERROR POSITION TESTS ===\n');
{
  const cases: Array<[string, string]> = [
    [`SELEKT * FROM employees;`, `bad keyword`],
    [`SELECT * FORM employees;`, `bad keyword FORM`],
    [`SELECT * FROM ;`, `missing table name`],
    [`SELECT * FROM "`, `unterminated quoted identifier`],
  ];
  for (const [sql, label] of cases) {
    const fresh = JSON.parse(JSON.stringify(db)) as Database;
    const r = runQuery(fresh, sql);
    console.log('─'.repeat(70));
    console.log(`▶ ${label}`);
    console.log(`SQL: ${sql}`);
    if (r.ok) {
      console.log(`✗ expected error, got success`);
      failures.push(`expected error for: ${label}`);
    } else {
      console.log(`✓ error: ${r.error}`);
      if (typeof r.errorPos === 'number') {
        const before = sql.slice(0, r.errorPos);
        const line = before.split('\n').length;
        const col = r.errorPos - before.lastIndexOf('\n');
        console.log(`✓ errorPos = ${r.errorPos}  (line=${line}, col=${col})`);
      } else {
        console.log(`✗ errorPos missing`);
        failures.push(`errorPos missing for: ${label}`);
      }
    }
  }
}

console.log('\n=== DONE ===\n');
if (failures.length === 0) {
  console.log('✅ All assertions passed.');
} else {
  console.log(`❌ ${failures.length} assertion(s) failed:`);
  for (const f of failures) console.log(`   - ${f}`);
  process.exit(1);
}