# Usher MCP — Movie Detail App

Interactive MCP server and UI widget that renders movie details from TMDB with the MCP Apps spec. The server runs on Cloudflare Workers; the UI is a sandboxed HTML resource served via ASSETS and rendered by MCP hosts.

## What’s here

- **MCP server** (`server/`) exposing:
  - `ui://widget/movie-detail-widget.html` resource (HTML + CSS + JS from ASSETS)
  - Tool `get-movie-detail` that searches TMDB by title and returns details + cast
- **Widget UI** (`web/`) built with React/Tailwind:
  - Entry: `widget.html` → `movie-detail-widget.js`/`.css`
  - MCP Apps lifecycle: `ui/initialize`, tool input/result notifications, `ui/open-link` for showtimes
  - Showtimes link opens Google “<title> showtimes near me” via `ui/open-link`
- **Root landing page**: friendly message at `/` telling visitors to connect via `/mcp`

## Prerequisites

- Node 18+
- Wrangler CLI
- TMDB API token (v4 bearer) stored as a secret

## Install

```bash
npm install
```

## Local dev (Workers)

Use `.dev.vars` for local secrets:

```
TMDB_TOKEN=your_tmdb_bearer_token
```

Run dev server:

```bash
npm run dev
```

MCP endpoint will be at `http://localhost:8787/mcp`.

## Build the widget

```bash
npm run web:build
```

Outputs to `web/dist/`:

- `movie-detail-widget.js`
- `movie-detail-widget.css`
- `widget.html`

These are served by the ASSETS binding for the MCP UI resource.

## Deploy to Cloudflare Workers

1. Set the secret in your account:

```bash
wrangler secret put TMDB_TOKEN
```

2. Deploy:

```bash
npm run deploy
```

## MCP server code pointers

- `server/lib/mcp.ts` — registers resource + tool, uses ASSETS to serve built widget, pulls `tmdbToken` from env binding.
- `server/index.ts` — Hono entry, mounts `/mcp` and root landing page.
- `web/src/movie-detail-widget.tsx` — MCP Apps UI logic + render.
- `web/vite.config.ts` — builds widget assets with custom filenames for ASSETS.

## MCP tool contract

- Tool: `get-movie-detail`
- Input: `{ "query": "<movie title>" }`
- Returns:
  - `content`: text fallback
  - `structuredContent.movie`: movie payload (title, poster/backdrop URLs, runtime, genres, rating, cast, etc.)

## Notes for hosts

- UI resource URI: `ui://widget/movie-detail-widget.html`
- MIME: `text/html+mcp`
- CSP: allows `https://image.tmdb.org/` for posters/backdrops
- Expects MCP Apps messages:
  - `ui/notifications/tool-input` / `tool-input-partial`
  - `ui/notifications/tool-result`
  - `ui/open-link` (to open showtimes link)

## Type generation

Regenerate Cloudflare binding types if config changes:

```bash
npm run cf-typegen
```

## Troubleshooting

- Missing TMDB token: set `TMDB_TOKEN` in `.dev.vars` (local) and via `wrangler secret put` (prod).
- Assets not loading: ensure `npm run web:build` was run and ASSETS binding is present.
- Host rejects `ui/open-link`: host must support MCP Apps `ui/open-link`; otherwise widget will show an error state.
