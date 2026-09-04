// Simple SQL tokenizer

import { SQLError } from './errors';

export type TokenType =
  | 'KEYWORD'
  | 'IDENT'
  | 'NUMBER'
  | 'STRING'
  | 'PUNCT'
  | 'OPERATOR'
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  pos: number;
}

const KEYWORDS = new Set([
  'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET',
  'DELETE', 'CREATE', 'TABLE', 'DROP', 'PRIMARY', 'KEY', 'NOT', 'NULL',
  'AND', 'OR', 'AS', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'ON', 'GROUP',
  'BY', 'HAVING', 'ORDER', 'ASC', 'DESC', 'LIMIT', 'OFFSET', 'DISTINCT',
  'INT', 'INTEGER', 'TEXT', 'VARCHAR', 'REAL', 'FLOAT', 'BOOLEAN',
  'BOOL', 'TRUE', 'FALSE', 'LIKE', 'BETWEEN', 'IN', 'IS', 'COUNT',
  'SUM', 'AVG', 'MIN', 'MAX', 'IF', 'EXISTS', 'RETURNING',
  'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
]);

export class Tokenizer {
  private input: string;
  private pos = 0;

  constructor(input: string) {
    this.input = input;
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];
    while (this.pos < this.input.length) {
      const ch = this.input[this.pos];
      if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
        this.pos++;
        continue;
      }
      // Line comment --
      if (ch === '-' && this.input[this.pos + 1] === '-') {
        while (this.pos < this.input.length && this.input[this.pos] !== '\n') {
          this.pos++;
        }
        continue;
      }
      // String literal
      if (ch === "'") {
        tokens.push(this.readString());
        continue;
      }
      // Double-quoted identifier
      if (ch === '"') {
        tokens.push(this.readQuotedIdent());
        continue;
      }
      // Number
      if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(this.input[this.pos + 1] || '')) ) {
        tokens.push(this.readNumber());
        continue;
      }
      // Identifier / keyword
      if (/[A-Za-z_]/.test(ch)) {
        tokens.push(this.readIdent());
        continue;
      }
      // Operators / punctuation
      tokens.push(this.readPunct());
    }
    tokens.push({ type: 'EOF', value: '', pos: this.pos });
    return tokens;
  }

  private readString(): Token {
    const start = this.pos;
    this.pos++; // skip opening quote
    let value = '';
    while (this.pos < this.input.length && this.input[this.pos] !== "'") {
      if (this.input[this.pos] === "'" && this.input[this.pos + 1] === "'") {
        value += "'";
        this.pos += 2;
        continue;
      }
      value += this.input[this.pos];
      this.pos++;
    }
    if (this.pos >= this.input.length) {
      throw new SQLError(`Unterminated string literal starting at position ${start}`, start);
    }
    this.pos++; // skip closing quote
    return { type: 'STRING', value, pos: start };
  }

  private readQuotedIdent(): Token {
    const start = this.pos;
    this.pos++;
    let value = '';
    while (this.pos < this.input.length && this.input[this.pos] !== '"') {
      value += this.input[this.pos];
      this.pos++;
    }
    if (this.pos >= this.input.length) {
      throw new SQLError(`Unterminated quoted identifier at position ${start}`, start);
    }
    this.pos++;
    return { type: 'IDENT', value, pos: start };
  }

  private readNumber(): Token {
    const start = this.pos;
    let value = '';
    while (this.pos < this.input.length && /[0-9.]/.test(this.input[this.pos])) {
      value += this.input[this.pos];
      this.pos++;
    }
    return { type: 'NUMBER', value, pos: start };
  }

  private readIdent(): Token {
    const start = this.pos;
    let value = '';
    while (this.pos < this.input.length && /[A-Za-z0-9_]/.test(this.input[this.pos])) {
      value += this.input[this.pos];
      this.pos++;
    }
    const upper = value.toUpperCase();
    if (KEYWORDS.has(upper)) {
      return { type: 'KEYWORD', value: upper, pos: start };
    }
    return { type: 'IDENT', value, pos: start };
  }

  private readPunct(): Token {
    const start = this.pos;
    const two = this.input.substr(this.pos, 2);
    if (['<=', '>=', '<>', '!=', '||', '::'].includes(two)) {
      this.pos += 2;
      return { type: 'OPERATOR', value: two, pos: start };
    }
    const ch = this.input[this.pos];
    this.pos++;
    if ('(),;.'.includes(ch)) {
      return { type: 'PUNCT', value: ch, pos: start };
    }
    if ('=<>+-*/%'.includes(ch)) {
      return { type: 'OPERATOR', value: ch, pos: start };
    }
    throw new SQLError(`Unexpected character '${ch}'`, start);
  }
}