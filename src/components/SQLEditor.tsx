import { useEffect, useMemo, useRef } from 'react';
import { highlightSQL } from '../utils/highlight';

interface SQLEditorProps {
  value: string;
  onChange: (v: string) => void;
  onRun: () => void;
  onClear: () => void;
  rows?: number;
}

export function SQLEditor({ value, onChange, onRun, onClear, rows = 8 }: SQLEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const highlighted = useMemo(() => highlightSQL(value) + '\n', [value]);

  useEffect(() => {
    const ta = textareaRef.current;
    const ov = overlayRef.current;
    if (!ta || !ov) return;
    const sync = () => {
      ov.scrollTop = ta.scrollTop;
      ov.scrollLeft = ta.scrollLeft;
    };
    ta.addEventListener('scroll', sync);
    return () => ta.removeEventListener('scroll', sync);
  }, []);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const next = value.slice(0, start) + '  ' + value.slice(end);
      onChange(next);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
      });
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onRun();
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'l' || e.key === 'L')) {
      e.preventDefault();
      onClear();
    }
  };

  return (
    <div className="relative panel overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-sql-border bg-slate-800/40">
        <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">SQL Editor</div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 hidden sm:inline">Ctrl/⌘+Enter to run · Ctrl/⌘+L to clear</span>
          <button className="btn btn-ghost text-xs" onClick={onClear}>Clear</button>
          <button className="btn btn-primary text-xs" onClick={onRun}>▶ Run</button>
        </div>
      </div>
      <div className="relative">
        <div
          ref={overlayRef}
          className="sql-editor-overlay"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
        <textarea
          ref={textareaRef}
          className="sql-textarea block p-3 min-h-[12rem]"
          style={{ height: `${rows * 1.5}rem` }}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKey}
          spellCheck={false}
          placeholder={`-- Try a query, e.g.
SELECT name, salary FROM employees WHERE salary > 70000 ORDER BY salary DESC;`}
        />
      </div>
    </div>
  );
}