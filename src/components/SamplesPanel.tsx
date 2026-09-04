import { SAMPLES } from '../utils/samples';

interface SamplesPanelProps {
  onPick: (sql: string) => void;
}

export function SamplesPanel({ onPick }: SamplesPanelProps) {
  return (
    <div className="space-y-1">
      {SAMPLES.map(s => (
        <button
          key={s.name}
          onClick={() => onPick(s.sql)}
          className="w-full text-left px-3 py-2 rounded-md border border-sql-border bg-slate-800/40 hover:bg-slate-700/50 transition-colors"
        >
          <div className="text-sm text-sql-accent font-medium">{s.name}</div>
          <code className="block font-mono text-[11px] text-slate-400 mt-1 whitespace-pre-wrap line-clamp-2">{s.sql}</code>
        </button>
      ))}
    </div>
  );
}