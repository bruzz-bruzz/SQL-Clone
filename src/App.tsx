import { useEffect, useMemo, useState } from 'react';
import type { Database, QueryResult, ResultSet } from './types/sql';
import { runQuery } from './engine';
import { createSampleDatabase } from './utils/samples';
import { SQLEditor } from './components/SQLEditor';
import { ResultTable } from './components/ResultTable';
import { SchemaViewer } from './components/SchemaViewer';
import { HistoryPanel, type HistoryEntry } from './components/HistoryPanel';
import { SamplesPanel } from './components/SamplesPanel';
import { ErrorView } from './components/ErrorView';

interface BatchResult {
  results: ResultSet[];
  raw: QueryResult;
}

const STORAGE_KEY = 'sqlclone-db';

function loadDb(): Database {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const obj = JSON.parse(raw);
      if (obj && typeof obj === 'object' && obj.tables) return obj as Database;
    }
  } catch { /* ignore */ }
  return createSampleDatabase();
}

function saveDb(db: Database) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch { /* ignore */ }
}

type TabKey = 'results' | 'history' | 'samples' | 'schema';

export default function App() {
  const [db, setDb] = useState<Database>(() => loadDb());
  const [sql, setSql] = useState<string>(`SELECT name, salary FROM employees ORDER BY salary DESC;`);
  const [batch, setBatch] = useState<BatchResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [tab, setTab] = useState<TabKey>('results');

  useEffect(() => { saveDb(db); }, [db]);

  const run = () => {
    if (!sql.trim()) return;
    const fresh: Database = JSON.parse(JSON.stringify(db));
    const result = runQuery(fresh, sql);
    setBatch({ results: result.results, raw: result });
    if (result.ok) setDb(fresh);
    setHistory(h => [...h, {
      sql,
      ok: result.ok,
      message: result.results.map(r => r.message).filter(Boolean).join('; ') || `${result.results.reduce((s, r) => s + r.rows.length, 0)} row(s)`,
      error: result.error,
      timestamp: Date.now(),
    }]);
    setTab('results');
  };

  const resetDb = () => {
    if (!confirm('Reset to sample database? This will erase all current tables and rows.')) return;
    const fresh = createSampleDatabase();
    setDb(fresh);
    setBatch(null);
    setHistory([]);
  };

  const clearDb = () => {
    setDb({ tables: {} });
    setBatch(null);
  };

  const execTime = batch?.raw.executionTimeMs;
  const totalRows = useMemo(() => batch?.results.reduce((s, r) => s + r.rows.length, 0) ?? 0, [batch]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-4 sm:px-6 py-3 border-b border-sql-border bg-slate-900/80 backdrop-blur flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-sql-accent/20 border border-sql-accent/40 flex items-center justify-center text-sql-accent font-bold">SQL</div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">SQL Clone</h1>
            <p className="text-[11px] text-slate-400 -mt-0.5">An in-browser SQL simulator</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button className="btn btn-ghost text-xs" onClick={clearDb}>Clear DB</button>
          <button className="btn btn-danger text-xs" onClick={resetDb}>Reset Samples</button>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 p-4 sm:p-6">
        <section className="flex flex-col gap-4 min-w-0">
          <SQLEditor value={sql} onChange={setSql} onRun={run} onClear={() => setSql('')} />

          <div className="panel overflow-hidden">
            <div className="flex items-center border-b border-sql-border bg-slate-800/40">
              <TabButton current={tab} target="results" onClick={setTab}>Results</TabButton>
              <TabButton current={tab} target="schema" onClick={setTab}>Schema</TabButton>
              <TabButton current={tab} target="history" onClick={setTab}>History</TabButton>
              <TabButton current={tab} target="samples" onClick={setTab}>Samples</TabButton>
              <div className="ml-auto px-3 text-[11px] text-slate-400">
                {batch && (
                  batch.raw.ok
                    ? <>✓ {totalRows} row{totalRows === 1 ? '' : 's'} · {execTime?.toFixed(2)} ms</>
                    : <>✗ Error</>
                )}
              </div>
            </div>
            <div className="p-3 min-h-[12rem] max-h-[60vh] overflow-auto">
              {tab === 'results' && (
                <>
                  {batch ? (
                    batch.raw.ok ? (
                      <div className="space-y-4">
                        {batch.results.length === 0 && (
                          <div className="text-slate-400 italic text-sm">Query executed successfully (no result set).</div>
                        )}
                        {batch.results.map((r, i) => (
                          <div key={i}>
                            {batch.results.length > 1 && (
                              <div className="text-xs text-slate-400 mb-1">Result #{i + 1}</div>
                            )}
                            <ResultTable
                              result={r}
                              exportName={exportNameFor(sql, i)}
                            />
                            {r.message && <div className="mt-1 text-[11px] text-slate-400">{r.message}</div>}
                            {batch.results.length === 1 && typeof execTime === 'number' && (
                              <div className="mt-1 text-[11px] text-slate-500">⏱ {execTime.toFixed(2)} ms</div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <ErrorView
                        message={batch.raw.error ?? 'Unknown error'}
                        source={sql}
                        pos={batch.raw.errorPos}
                      />
                    )
                  ) : (
                    <div className="text-slate-400 italic text-sm">Run a query to see results.</div>
                  )}
                </>
              )}
              {tab === 'schema' && <SchemaViewer db={db} />}
              {tab === 'history' && (
                <HistoryPanel
                  history={history}
                  onPick={s => { setSql(s); setTab('results'); }}
                  onClear={() => setHistory([])}
                />
              )}
              {tab === 'samples' && (
                <SamplesPanel onPick={s => { setSql(s); setTab('results'); }} />
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-4 min-w-0">
          <div className="panel p-4">
            <div className="text-xs uppercase tracking-wider text-slate-400 mb-2 font-semibold">Quick Reference</div>
            <ul className="text-xs text-slate-300 space-y-1.5">
              <li><code className="text-sql-accent">CREATE TABLE</code> · <code className="text-sql-accent">DROP TABLE</code></li>
              <li><code className="text-sql-accent">INSERT</code> · <code className="text-sql-accent">UPDATE</code> · <code className="text-sql-accent">DELETE</code></li>
              <li><code className="text-sql-accent">SELECT</code> with <code>WHERE</code>, <code>ORDER BY</code>, <code>LIMIT</code></li>
              <li>Joins: <code>INNER</code>, <code>LEFT</code>, <code>RIGHT</code></li>
              <li>Aggregates: <code>COUNT</code>, <code>SUM</code>, <code>AVG</code>, <code>MIN</code>, <code>MAX</code> with <code>GROUP BY</code> / <code>HAVING</code></li>
              <li>Patterns: <code>LIKE '%foo%'</code>, <code>BETWEEN</code>, <code>IN (...)</code>, <code>IS NULL</code></li>
              <li>Conditionals: <code>CASE WHEN ... THEN ... ELSE ... END</code></li>
              <li>DML: append <code>RETURNING *</code> or <code>RETURNING col[, ...]</code> to <code>INSERT</code>/<code>UPDATE</code>/<code>DELETE</code></li>
              <li>Multiple statements supported; separate with <code>;</code></li>
            </ul>
          </div>
          <div className="panel p-4">
            <div className="text-xs uppercase tracking-wider text-slate-400 mb-2 font-semibold">Storage</div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Your database is saved automatically in your browser (<code>localStorage</code>).
              Use <span className="text-rose-300">Reset Samples</span> to start over.
            </p>
          </div>
        </aside>
      </main>

      <footer className="px-4 sm:px-6 py-2 border-t border-sql-border text-[11px] text-slate-500 flex items-center gap-3">
        <span>SQL Clone · {Object.keys(db.tables).length} table{Object.keys(db.tables).length === 1 ? '' : 's'}</span>
        <span className="ml-auto">Built with React + Vite + TailwindCSS</span>
      </footer>
    </div>
  );
}

function TabButton({
  current, target, onClick, children,
}: {
  current: TabKey;
  target: TabKey;
  onClick: (t: TabKey) => void;
  children: React.ReactNode;
}) {
  const active = current === target;
  return (
    <button
      onClick={() => onClick(target)}
      className={`px-3 py-2 text-sm border-b-2 -mb-1 ${active
        ? 'border-sql-accent text-sql-accent font-semibold'
        : 'border-transparent text-slate-300 hover:text-slate-100'
      }`}
    >
      {children}
    </button>
  );
}

// Produce a friendly CSV filename: try the first table name referenced,
// then the first keyword, then a positional default.
function exportNameFor(sql: string, index: number): string {
  const fromMatch = sql.match(/\bFROM\s+["`"]?(\w+)["`"]?/i);
  if (fromMatch) return fromMatch[1].toLowerCase();
  const intoMatch = sql.match(/\bINTO\s+["`"]?(\w+)["`"]?/i);
  if (intoMatch) return intoMatch[1].toLowerCase();
  const updateMatch = sql.match(/\bUPDATE\s+["`"]?(\w+)["`"]?/i);
  if (updateMatch) return updateMatch[1].toLowerCase();
  if (index > 0) return `results-${index + 1}`;
  return 'results';
}