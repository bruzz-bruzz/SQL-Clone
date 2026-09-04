import type { ResultSet } from '../types/sql';

interface ResultTableProps {
  result: ResultSet;
}

function formatValue(v: any): string {
  if (v === null) return 'NULL';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
}

export function ResultTable({ result }: ResultTableProps) {
  if (result.rows.length === 0) {
    return (
      <div className="text-slate-400 italic px-4 py-6 text-sm">
        {result.message ?? 'No rows returned'}
      </div>
    );
  }
  return (
    <div className="overflow-auto">
      <table className="min-w-full border-collapse">
        <thead>
          <tr>
            <th className="table-th w-12 text-right">#</th>
            {result.columns.map(c => (
              <th key={c} className="table-th">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, ri) => (
            <tr key={ri} className="table-tr">
              <td className="table-td text-right text-slate-500 text-xs">{ri + 1}</td>
              {row.map((v, ci) => (
                <td key={ci} className={`table-td font-mono ${v === null ? 'text-slate-500 italic' : ''}`}>
                  {formatValue(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}