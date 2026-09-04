import type { Database } from '../types/sql';

interface SchemaViewerProps {
  db: Database;
}

export function SchemaViewer({ db }: SchemaViewerProps) {
  const tables = Object.values(db.tables);
  if (tables.length === 0) {
    return (
      <div className="text-slate-400 italic text-sm px-3 py-4">
        No tables yet. Run a <code className="font-mono text-sql-accent">CREATE TABLE</code> to begin.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {tables.map(t => (
        <div key={t.schema.name} className="border border-sql-border rounded-md bg-slate-800/30 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-sql-border bg-slate-800/60">
            <div className="font-mono text-sql-accent text-sm font-semibold">{t.schema.name}</div>
            <div className="text-[10px] text-slate-400">{t.rows.length} row{t.rows.length === 1 ? '' : 's'}</div>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="table-th py-1.5">Column</th>
                <th className="table-th py-1.5">Type</th>
                <th className="table-th py-1.5">Key</th>
              </tr>
            </thead>
            <tbody>
              {t.schema.columns.map(c => (
                <tr key={c.name}>
                  <td className="table-td py-1.5 font-mono">{c.name}</td>
                  <td className="table-td py-1.5 font-mono text-sql-string">{c.type}</td>
                  <td className="table-td py-1.5 text-slate-400">
                    {c.primaryKey && <span className="text-rose-300 mr-1">PK</span>}
                    {c.notNull && !c.primaryKey && <span>NOT NULL</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}