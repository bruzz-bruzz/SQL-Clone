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
    console.log(`✗ ERROR: ${r.error}`);
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

console.log('\n=== DONE ===\n');