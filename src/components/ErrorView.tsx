import { useMemo } from 'react';
import { snippetForPos, caretPointer, posToLineCol } from '../utils/error';

interface ErrorViewProps {
  message: string;
  source: string;
  pos?: number;
}

export function ErrorView({ message, source, pos }: ErrorViewProps) {
  const hasPos = typeof pos === 'number' && pos >= 0 && pos <= source.length;
  const { line, col } = useMemo(
    () => (hasPos ? posToLineCol(source, pos as number) : { line: 0, col: 0 }),
    [source, pos, hasPos],
  );
  const snippets = useMemo(
    () => (hasPos ? snippetForPos(source, pos as number, 1) : []),
    [source, pos, hasPos],
  );
  const caretLine = useMemo(
    () => (snippets.length ? caretPointer(snippets[Math.max(0, snippets.findIndex(s => s.lineNumber === line))]) : ''),
    [snippets, line],
  );
  return (
    <div className="text-rose-300 text-sm font-mono">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-rose-400 font-semibold">Error</span>
        <span className="text-slate-200 break-words">{message}</span>
        {hasPos && (
          <span className="text-[11px] text-slate-400 ml-auto">
            at line {line}, column {col}
          </span>
        )}
      </div>
      {hasPos && snippets.length > 0 && (
        <pre className="mt-2 bg-rose-950/40 border border-rose-900/50 rounded p-2 text-[12px] leading-relaxed overflow-x-auto whitespace-pre">
          {snippets.map(s => (
            <div key={s.lineNumber}>
              <span className="text-slate-500">{s.prefix}</span>
              <span className="text-rose-100">{s.lineText || ' '}</span>
            </div>
          ))}
          {caretLine && (
            <div className="text-rose-300">{caretLine}</div>
          )}
        </pre>
      )}
    </div>
  );
}
