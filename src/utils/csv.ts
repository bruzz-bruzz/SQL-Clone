// CSV serialization for ResultSet rows. RFC-4180 quoting.
//   - null -> empty cell
//   - booleans -> "true" / "false"
//   - any cell containing comma, quote, or newline is wrapped in quotes
//   - internal quotes are doubled

import type { ResultSet, Value } from '../types/sql';

function quoteIfNeeded(v: string): string {
  if (/[",\r\n]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

function cellToCsv(v: Value): string {
  if (v === null) return '';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return '';
    return String(v);
  }
  return quoteIfNeeded(String(v));
}

export function resultSetToCsv(rs: ResultSet): string {
  const lines: string[] = [];
  lines.push(rs.columns.map(quoteIfNeeded).join(','));
  for (const row of rs.rows) {
    lines.push(row.map(cellToCsv).join(','));
  }
  // RFC 4180 uses CRLF; we use LF for friendlier output in tools that care.
  return lines.join('\n');
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer revoke a bit to let the click handler complete.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
