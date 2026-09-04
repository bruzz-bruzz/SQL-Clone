interface HistoryEntry {
  sql: string;
  ok: boolean;
  message?: string;
  error?: string;
  timestamp: number;
}

interface HistoryPanelProps {
  history: HistoryEntry[];
  onPick: (sql: string) => void;
  onClear: () => void;
}

export function HistoryPanel({ history, onPick, onClear }: HistoryPanelProps) {
  if (history.length === 0) {
    return <div className="text-slate-400 italic text-sm px-3 py-4">No queries run yet.</div>;
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">{history.length} quer{history.length === 1 ? 'y' : 'ies'}</span>
        <button onClick={onClear} className="text-xs text-slate-400 hover:text-rose-300">Clear</button>
      </div>
      {history.slice().reverse().map((h, i) => (
        <button
          key={i}
          onClick={() => onPick(h.sql)}
          className="w-full text-left px-3 py-2 rounded-md border border-sql-border bg-slate-800/40 hover:bg-slate-700/50 transition-colors"
        >
          <div className="flex items-center gap-2 mb-1">
            <span className={`h-2 w-2 rounded-full ${h.ok ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
            <span className="text-[10px] text-slate-500">
              {new Date(h.timestamp).toLocaleTimeString()}
            </span>
            <span className="text-[10px] text-slate-400 truncate ml-auto">
              {h.ok ? h.message : h.error}
            </span>
          </div>
          <code className="block font-mono text-xs text-slate-300 whitespace-pre-wrap break-words line-clamp-3">{h.sql}</code>
        </button>
      ))}
    </div>
  );
}

export type { HistoryEntry };