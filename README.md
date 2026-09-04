# SQL Clone

A lightweight SQL playground written in **TypeScript**, **React**, **Vite**, and **TailwindCSS**. The tokenizer, parser, and executor are implemented from scratch in TypeScript — **no external SQL engine, no server**. Your database lives entirely in your browser's `localStorage`.

The app is a single-page static bundle that can be hosted on any static host (Vercel, Netlify, GitHub Pages, S3 + CloudFront, etc.). See [Deploy to Vercel](#deploy-to-vercel) below.

## Features

- **DDL** — `CREATE TABLE` (with `INT` / `TEXT` / `REAL` / `BOOLEAN` types; `PRIMARY KEY`, `NOT NULL`), `DROP TABLE`.
- **DML** — `INSERT`, `UPDATE`, `DELETE` (single + multi-row `VALUES`).
- **SELECT** with:
  - `WHERE` (comparisons, `AND` / `OR` / `NOT`, `LIKE`, `BETWEEN`, `IN (...)`, `IS NULL`)
  - `ORDER BY ASC/DESC`, `LIMIT` / `OFFSET`, `DISTINCT`
  - `GROUP BY` / `HAVING`
  - Aggregates: `COUNT(*)`, `COUNT(expr)`, `SUM`, `AVG`, `MIN`, `MAX`
  - Joins: `INNER`, `LEFT`, `RIGHT` with `ON`
  - Arithmetic expressions and column aliases
- **Expressions** — `CASE WHEN ... THEN ... ELSE ... END` (both searched and simple forms).
- **RETURNING** — append `RETURNING *` or `RETURNING col[, ...]` to `INSERT` / `UPDATE` / `DELETE` to see the affected rows.
- **Multiple statements** per execution, separated by `;`.
- **Structured error reporting** — parser and tokenizer report a caret position that the UI renders as an inline snippet with a `^` pointer.
- **CSV export** — every result set can be downloaded as RFC-4180 CSV with a single click.
- **Per-result timing** — execution time is shown next to each result.
- **Persistent database** in `localStorage`, with a built-in seed (employees / departments / projects).
- **Syntax-highlighted editor** — **Ctrl/? + Enter** to run, **Ctrl/? + L** to clear, history panel with one-click re-run.

## Getting started

```bash
npm install
npm run dev          # start the dev server
npm run build        # type-check + production build
npm run preview      # serve the production build locally
npm run test:engine  # run the engine test suite
```

The test suite is a single Node script (`scripts/test-engine.ts`) that boots a sample database and asserts the engine behaves correctly. It uses `tsx` so there is no separate compile step.

## Project structure

```
sqlClone/
|-- index.html              # Vite entry
|-- vercel.json             # Vercel deploy config (SPA rewrite -> /index.html)
|-- .vercelignore           # Vercel upload exclusion list
|-- public/                 # static assets
|-- src/
|   |-- main.tsx            # React entry
|   |-- App.tsx             # UI shell, query routing, history, timing
|   |-- index.css           # Tailwind + custom styles
|   |-- components/
|   |   |-- SQLEditor.tsx   # Syntax-highlighted editor
|   |   |-- ResultTable.tsx # Result renderer (row count + CSV download)
|   |   |-- ErrorView.tsx   # Caret-style error display
|   |   |-- SchemaViewer.tsx
|   |   |-- HistoryPanel.tsx
|   |   `-- SamplesPanel.tsx
|   |-- engine/
|   |   |-- tokenizer.ts    # SQL lexer
|   |   |-- parser.ts       # Recursive descent parser
|   |   |-- executor.ts     # Tree-walking evaluator
|   |   |-- errors.ts       # SQLError + position extraction
|   |   `-- index.ts        # runQuery() entry point
|   |-- types/
|   |   `-- sql.ts          # AST + database types
|   `-- utils/
|       |-- error.ts        # posToLineCol + caret snippet
|       |-- csv.ts          # RFC-4180 CSV serializer + downloader
|       |-- highlight.ts    # SQL syntax highlighter
|       `-- samples.ts      # Sample data + queries
`-- scripts/
    `-- test-engine.ts      # 50+ assertion engine test suite
```

## Deploy to Vercel

The repo ships with a `vercel.json` so it deploys with **zero configuration** — Vercel auto-detects the `vite` framework, runs `npm run build`, and serves `dist/`.

### One-time setup

1. Push the repo to GitHub / GitLab / Bitbucket.
2. Go to [vercel.com/new](https://vercel.com/new) and import the project.
3. Vercel pre-fills the framework as **Vite**. Accept the defaults and click **Deploy**.

That is it. No environment variables, no build settings, no serverless functions.

### What the config does

`vercel.json`:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

The `rewrites` entry is what makes deep links and a future client-side router work — Vercel serves `index.html` for any path that does not match a static file in `dist/`, then the React app takes over.

`.vercelignore` keeps the deploy lean: `node_modules`, `dist`, build-info files, and the local `scripts/` test runner are excluded from the upload bundle.

### Deploy from the CLI

```bash
npm i -g vercel
vercel        # preview deploy (asks to link the project on first run)
vercel --prod # production deploy
```

The CLI also picks up `vercel.json` automatically.

## Deploy to other static hosts

The app is a pure static SPA. The only hosting requirement is that the host fall back to `index.html` for unknown routes. The common equivalents:

- **Netlify** — add `public/_redirects` with `/*  /index.html  200`, or a `netlify.toml` with a `[[redirects]]` block.
- **GitHub Pages** — works out of the box since the app is single-route; you can skip the rewrite.
- **Cloudflare Pages** — add a `_redirects` file with `/*  /index.html  200`.
- **S3 + CloudFront** — configure two origin behaviors: default -> `index.html` (HTTP 200), real files -> 403/404 -> fallback to `index.html`.

## Architecture notes

- **No backend.** The "database" is a plain JS object held in memory and persisted to `localStorage` after every write. Schema validation (column types, NOT NULL, PRIMARY KEY uniqueness) is enforced by the executor.
- **Single-statement, multi-statement** — the engine splits input on `;` and runs each statement in order. DDL/DML mutate the in-memory database; `SELECT` produces a result.
- **Errors** — the tokenizer and parser throw `SQLError { pos }`; the executor throws plain `Error`. The top-level `runQuery` extracts a position from either kind and returns it as `errorPos` on the `QueryResult`. The UI turns that into a `line | col` snippet with a `^` caret.
- **RETURNING** — `INSERT` / `UPDATE` / `DELETE` collect snapshots of the affected rows just before they leave the in-memory table. The UI then projects them through the `RETURNING` list (either `*` for the full row, or arbitrary expressions with optional aliases).
- **CSV** — uses LF line endings (friendlier for `awk` / `wc -l`), only quotes cells that contain `,`, `"`, `\r`, or `\n`, escapes `"` as `""`. `null` cells are empty; non-finite numbers (`NaN`, `Infinity`) are empty.

## License

MIT.
