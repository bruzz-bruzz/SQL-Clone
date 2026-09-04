import type { Database } from '../types/sql';
import { runQuery } from '../engine';

export interface Sample {
  name: string;
  sql: string;
}

// Build a small sample database with employees, departments and projects.
export function createSampleDatabase(): Database {
  const db: Database = { tables: {} };
  const schema: { sql: string }[] = [
    {
      sql: `
        CREATE TABLE departments (
          id INT PRIMARY KEY,
          name TEXT NOT NULL
        );
        CREATE TABLE employees (
          id INT PRIMARY KEY,
          name TEXT NOT NULL,
          department_id INT,
          salary REAL,
          active BOOLEAN
        );
        CREATE TABLE projects (
          id INT PRIMARY KEY,
          name TEXT NOT NULL,
          lead_id INT,
          budget REAL
        );
        INSERT INTO departments (id, name) VALUES (1, 'Engineering'), (2, 'Sales'), (3, 'HR');
        INSERT INTO employees (id, name, department_id, salary, active) VALUES
          (1, 'Alice', 1, 90000, TRUE),
          (2, 'Bob', 1, 85000, TRUE),
          (3, 'Carol', 2, 70000, TRUE),
          (4, 'Dan', 2, 72000, FALSE),
          (5, 'Eve', 3, 60000, TRUE),
          (6, 'Frank', 1, 110000, TRUE);
        INSERT INTO projects (id, name, lead_id, budget) VALUES
          (1, 'Apollo', 1, 50000),
          (2, 'Borealis', 2, 80000),
          (3, 'Comet', 6, 120000);
      `,
    },
  ];
  for (const { sql } of schema) {
    const r = runQuery(db, sql);
    if (!r.ok) {
      console.error('Failed to bootstrap sample DB:', r.error);
    }
  }
  return db;
}

export const SAMPLES: Sample[] = [
  {
    name: 'All employees',
    sql: `SELECT * FROM employees;`,
  },
  {
    name: 'Active employees in Engineering',
    sql: `SELECT name, salary
FROM employees
WHERE active = TRUE AND department_id = 1
ORDER BY salary DESC;`,
  },
  {
    name: 'Count employees per department',
    sql: `SELECT department_id, COUNT(*) AS total, AVG(salary) AS avg_salary
FROM employees
GROUP BY department_id
HAVING COUNT(*) >= 1
ORDER BY total DESC;`,
  },
  {
    name: 'JOIN: employees with department names',
    sql: `SELECT e.name, d.name AS department, e.salary
FROM employees e
INNER JOIN departments d ON e.department_id = d.id
WHERE e.salary > 70000
ORDER BY e.salary DESC;`,
  },
  {
    name: 'LIKE search',
    sql: `SELECT name FROM employees WHERE name LIKE 'A%';`,
  },
  {
    name: 'CASE WHEN — band employees by salary',
    sql: `SELECT name, salary,
  CASE
    WHEN salary >= 100000 THEN 'executive'
    WHEN salary >= 85000  THEN 'senior'
    WHEN salary >= 65000  THEN 'mid'
    ELSE 'junior'
  END AS band
FROM employees
ORDER BY salary DESC;`,
  },
  {
    name: 'Update salary',
    sql: `UPDATE employees SET salary = salary * 1.1 WHERE department_id = 1;`,
  },
  {
    name: 'Insert a new row',
    sql: `INSERT INTO employees (id, name, department_id, salary, active)
VALUES (7, 'Grace', 3, 65000, TRUE);`,
  },
  {
    name: 'Delete inactive employees',
    sql: `DELETE FROM employees WHERE active = FALSE;`,
  },
];