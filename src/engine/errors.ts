// Structured error type for the SQL engine. Carries an optional character
// position so the UI can render a caret pointer.

export class SQLError extends Error {
  pos?: number;
  constructor(message: string, pos?: number) {
    super(message);
    this.name = 'SQLError';
    this.pos = pos;
  }
}

// Try to recover a character position from an arbitrary thrown value.
// Heuristics:
//   1. If it's an SQLError with .pos, use it.
//   2. Otherwise, look for the last "at position N" / "at position N" suffix in the message.
export function extractPos(err: unknown, fallback?: number): number | undefined {
  if (err && typeof err === 'object' && 'pos' in (err as any) && typeof (err as any).pos === 'number') {
    return (err as any).pos as number;
  }
  const msg = (err as any)?.message ?? String(err);
  if (typeof msg === 'string') {
    const m = msg.match(/at position (\d+)/g);
    if (m && m.length) {
      const last = m[m.length - 1];
      const n = Number(last.replace(/[^0-9]/g, ''));
      if (!Number.isNaN(n)) return n;
    }
  }
  return fallback;
}
