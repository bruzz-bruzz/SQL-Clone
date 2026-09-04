import type { ResultSet } from '../types/sql';
import { resultSetToCsv, downloadCsv } from '../utils/csv';

interface ResultTableProps {
  result: ResultSet;
  /** Optional prefix for the downloaded CSV filename. Defaults to "results". */
  exportName?: string;
}

function formatValue(v: any): string {
  if (v === null) return 'NULL';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
}

export function ResultTable({ result, exportName = 'results' }: ResultTableProps) {
  if (result.rows.length === 0) {
    return (
      <div className="text-slate-400 italic px-4 py-6 text-sm">
        {result.message ?? 'No rows returned'}
      </div>
    );
  }
  const handleExport = () => {
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    downloadCsv(`${exportName}-${ts}.csv`, resultSetToCsv(result));
  };
  return (
    <div>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-sql-border bg-slate-800/30">
        <span className="text-[11px] text-slate-400">
          {result.rows.length} row{result.rows.length === 1 ? '' : 's'}
        </span>
        <button
          onClick={handleExport}
          className="text-[11px] text-sql-accent hover:underline"
          title="Download as CSV"
        >
          ⬇ Download CSV
        </button>
      </div>
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
    </div>
  );
}