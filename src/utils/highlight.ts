// Very small SQL syntax highlighter that returns HTML-safe spans.
const KEYWORDS = new Set([
  'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET',
  'DELETE', 'CREATE', 'TABLE', 'DROP', 'PRIMARY', 'KEY', 'NOT', 'NULL',
  'AND', 'OR', 'AS', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'ON', 'GROUP',
  'BY', 'HAVING', 'ORDER', 'ASC', 'DESC', 'LIMIT', 'OFFSET', 'DISTINCT',
  'INT', 'INTEGER', 'TEXT', 'VARCHAR', 'REAL', 'FLOAT', 'BOOLEAN',
  'BOOL', 'TRUE', 'FALSE', 'LIKE', 'BETWEEN', 'IN', 'IS', 'COUNT',
  'SUM', 'AVG', 'MIN', 'MAX', 'IF', 'EXISTS', 'RETURNING',
]);

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function highlightSQL(sql: string): string {
  let result = '';
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    // Comments -- to end of line
    if (ch === '-' && sql[i + 1] === '-') {
      let j = i;
      while (j < sql.length && sql[j] !== '\n') j++;
      result += `<span class="text-sql-comment italic">${escapeHtml(sql.slice(i, j))}</span>`;
      i = j;
      continue;
    }
    // Strings
    if (ch === "'") {
      let j = i + 1;
      while (j < sql.length && !(sql[j] === "'" && sql[j + 1] !== "'")) {
        if (sql[j] === "'" && sql[j + 1] === "'") j += 2;
        else j++;
      }
      j = Math.min(j + 1, sql.length);
      result += `<span class="text-sql-string">${escapeHtml(sql.slice(i, j))}</span>`;
      i = j;
      continue;
    }
    // Numbers
    if (/[0-9]/.test(ch)) {
      let j = i;
      while (j < sql.length && /[0-9.]/.test(sql[j])) j++;
      result += `<span class="text-sql-number">${escapeHtml(sql.slice(i, j))}</span>`;
      i = j;
      continue;
    }
    // Identifiers / keywords
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < sql.length && /[A-Za-z0-9_]/.test(sql[j])) j++;
      const word = sql.slice(i, j);
      if (KEYWORDS.has(word.toUpperCase())) {
        result += `<span class="text-sql-keyword font-bold">${escapeHtml(word)}</span>`;
      } else {
        result += escapeHtml(word);
      }
      i = j;
      continue;
    }
    // Whitespace
    if (/\s/.test(ch)) {
      let j = i;
      while (j < sql.length && /\s/.test(sql[j])) j++;
      result += escapeHtml(sql.slice(i, j));
      i = j;
      continue;
    }
    // Operators / punctuation
    const two = sql.substr(i, 2);
    if (['<=', '>=', '<>', '!=', '||'].includes(two)) {
      result += `<span class="text-sql-accent">${escapeHtml(two)}</span>`;
      i += 2;
      continue;
    }
    if ('=<>+-*/%,;.'.includes(ch)) {
      result += `<span class="text-sql-accent">${escapeHtml(ch)}</span>`;
      i++;
      continue;
    }
    result += escapeHtml(ch);
    i++;
  }
  return result;
}