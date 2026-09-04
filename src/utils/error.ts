// Utilities for mapping a flat character position to a {line, col} pair,
// and for rendering a source snippet with a caret pointer.

export interface LineCol {
  line: number; // 1-based
  col: number;  // 1-based
}

export function posToLineCol(source: string, pos: number): LineCol {
  if (pos < 0) pos = 0;
  if (pos > source.length) pos = source.length;
  let line = 1;
  let col = 1;
  for (let i = 0; i < pos; i++) {
    if (source[i] === '\n') {
      line++;
      col = 1;
    } else {
      col++;
    }
  }
  return { line, col };
}

export interface SourceSnippet {
  lineNumber: number;
  lineText: string;
  caretColumn: number; // 1-based column to point the caret at (clamped to line length)
  // Indent in spaces the source had been written with (rough; not used currently)
  prefix: string;
}

// Extracts the line containing `pos` plus a one-line context window around it.
// Returns lines sorted by line number, with a prefix to align line numbers.
export function snippetForPos(source: string, pos: number, context = 1): SourceSnippet[] {
  const { line } = posToLineCol(source, pos);
  const lines = source.split(/\r?\n/);
  const start = Math.max(1, line - context);
  const end = Math.min(lines.length, line + context);
  const width = String(end).length;
  const { col } = posToLineCol(source, pos);
  const out: SourceSnippet[] = [];
  for (let ln = start; ln <= end; ln++) {
    out.push({
      lineNumber: ln,
      lineText: lines[ln - 1] ?? '',
      caretColumn: ln === line ? col : 1,
      prefix: ' '.repeat(width - String(ln).length) + ln + ' | ',
    });
  }
  return out;
}

// Render a caret pointer (spaces + '^') aligned to the column.
export function caretPointer(snippet: SourceSnippet): string {
  const spaces = ' '.repeat(snippet.prefix.length + Math.max(0, snippet.caretColumn - 1));
  return spaces + '^';
}
