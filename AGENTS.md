# AGENTS.md

This document provides onboarding guidance for AI agents working on this repository.

## Project overview

A Tampermonkey userscript that overlays pace indicators on `claude.ai/settings/usage` — showing whether token usage is ahead or behind the expected rate for the current time window. The script adds a "now" marker band, over/under-pace pills, and a situation summary card to each usage bar (current 5-hour session, weekly all-models, weekly Sonnet, weekly Opus).

An optional companion MCP server lets Claude Code query pace statistics mid-session by receiving pre-computed state pushed from the userscript.

License: GPL-3.0-or-later.

## Tech stack

- **Runtime:** Bun (`bun` CLI for build and test)
- **Userscript:** Plain JavaScript modules (`src/userscript/`)
- **Shared logic:** TypeScript modules (`src/common/`) — constants, math, signals
- **MCP server:** TypeScript (`src/mcp/`) with `@modelcontextprotocol/sdk`
- **Build system:** Bun bundler via `build.ts`
- **Test runner:** Bun's built-in `bun:test` — no Jest/Vitest

## Commands

```bash
bun run build        # Bundle userscript + MCP server to dist/
bun test             # Run all tests (userscript + MCP server)
bun test tests/math.test.mjs   # Run a single test file
```

Build details: `build.ts` bundles `src/userscript/main.js` as an IIFE for browser targets, prepends the `meta.txt` userscript header, and writes both readable and minified outputs to `dist/`. The MCP server is bundled to `src/mcp/dist/index.js` via its own `build` script.

## Architecture

**Data flow:**

1. **Capture** (`capture.js`) — Patches `window.fetch` at `document-start` to intercept responses from `/api/organizations/{orgId}/usage`. Extracts the org ID and passes the JSON to a callback.

2. **Polling** (`polling.js`) — Once the org ID is known, polls the same endpoint at a configurable interval (default 10 minutes) using `GM_xmlhttpRequest`.

3. **Render** (`render.js`) — For each usage bucket, locates the DOM row by its heading text, applies a bar gradient, positions the "now" marker band, and builds/updates the pace pill. Includes a retry loop (100 ms × 30) for DOM readiness.

4. **Signals** (`signals.js`) — Calls `buildSignals` + `classifySituation` to compute pace deltas, severity, and pick the highest-priority situation message for the summary card.

5. **Config** (`config.js`) — Loads settings from `localStorage` on first access, merges over `CFG_DEFAULTS`, saves back on every change via the gear panel.

6. **Lifecycle** (`lifecycle.js`) — Wraps `history.pushState/replaceState` and listens for `popstate` to detect SPA navigation. Tears down all injected DOM nodes when leaving `/settings/usage`; re-injects and resumes polling on return. Re-renders every 30 seconds.

**Module map:**

- `capture.js` — Fetch patching and org ID extraction
- `polling.js` — Periodic `/usage` polling via `GM_xmlhttpRequest`
- `render.js` — DOM injection (bar gradients, marker bands, pills, situation card)
- `math.js` — Pure functions for pace math (active-hours elapsed, delta, severity)
- `constants.js` — Bucket definitions, time window defaults, neutral bands
- `signals.js` — Signal aggregation and situation classification
- `config.js` — Settings persistence and defaults
- `lifecycle.js` — SPA navigation handling and teardown/rehydrate
- `log.js` — Console logging with prefix
- `mcp-push.js` — Pushes pace state to local HTTP sidecar (127.0.0.1:4299)
- `payload.js` — Shapes the pushed payload format
- `ui/` — Styles, Lucide icons, settings panel components

**MCP server:** Runs locally on `127.0.0.1:4299`, receives pushed pace state from the userscript, and exposes it via `get_pace_stats` and `get_situation` tools to Claude Code. Fully optional — userscript works normally without it.

**Core math:** The weekly quota is expected to be consumed only during *active hours* (default 07:00–20:00). `activeElapsedPctOf` computes the fraction of total active-period hours passed; `deltaPpOf` subtracts that from `utilization` to get the pace delta in percentage-points. The session bucket (`five_hour`) uses wall-clock elapsed time, not active-hours math.

**Time windows:** Every moment is classified as `active` (07–20), `bonus` (20–23), or `sleep` (23–07). Window affects marker position (frozen/thawed) and which pill variant is shown.

## Source layout

```
src/
├── userscript/          # Browser-side userscript modules
│   ├── main.js          # Entry point, init, lifecycle orchestration
│   ├── capture.js       # Fetch patching
│   ├── polling.js       # Periodic API polling
│   ├── render.js        # DOM injection and updates
│   ├── math.js          # Re-exports from common/
│   ├── constants.js     # Re-exports from common/
│   ├── signals.js       # Re-exports from common/
│   ├── config.js        # Settings persistence
│   ├── lifecycle.js     # SPA navigation handling
│   ├── log.js           # Console logging
│   ├── mcp-push.js      # Push to HTTP sidecar
│   ├── payload.js       # Payload shaping
│   └── ui/              # Styles, icons, settings UI
├── common/              # Shared TypeScript (userscript + MCP)
│   ├── constants.ts     # Active hours, neutral bands, bucket defs
│   ├── math.ts          # Active-hours elapsed, delta, severity
│   └── signals.ts       # Signal aggregation, situation classification
└── mcp/                 # Optional MCP server
    ├── src/
    │   └── index.ts     # MCP server implementation
    ├── dist/            # Built server (bundled)
    ├── package.json     # MCP-specific dependencies
    └── README.md        # MCP setup guide
tests/                   # Test files (Bun test runner)
dist/                    # Built userscript outputs (committed, not gitignored)
build.ts                 # Bun build script (userscript bundling)
meta.txt                 # Userscript header (version, match, grants)
package.json             # Root metadata and scripts
```

## Key conventions

**Version string:** Lives in **three places** — bump all three on release:
1. `meta.txt` `@version` — load-bearing; Tampermonkey checks this for auto-updates
2. `package.json` `version` — kept in sync as convention
3. `src/userscript/main.js` — the `LOG('script loaded, version X.Y.Z')` line

**Commit status:** `dist/` is **committed on purpose** — the install URL points at the raw file on `main`. Deleting or gitignoring it breaks existing installs.

**Rebuild:** Always run `bun run build` after touching `src/` or `meta.txt`.

**Userscript lifecycle:** The script runs at `document-start`, patches `window.fetch` before the page loads, and uses `GM_xmlhttpRequest` for polling. The `@match` pattern in `meta.txt` targets `https://claude.ai/settings/usage*`.

**Pace math:** Weekly quota consumption is treated as spread evenly across *active hours only* (default 07:00–20:00). The session bucket (`five_hour`) uses wall-clock elapsed time within the 5-hour window, not active-hours math.

**Tests:** Use Bun's built-in test runner (`bun test`). Tests are located in `tests/` and `src/mcp/tests/`. No Jest/Vitest configuration.

**Shared code:** `src/common/` modules are written in TypeScript and used by both the userscript (re-exported in JS) and the MCP server. Type definitions are synced via `@types/bun` and `@types/node`.

## Release process

1. Bump version in all three locations (`meta.txt`, `package.json`, `src/userscript/main.js`)
2. Run `bun run build` to rebuild userscript and MCP server
3. Commit changes: `git add meta.txt package.json src/userscript/main.js dist/ && git commit -m "release: vX.Y.Z"`
4. Push: `git push`
5. Tag: `git tag -a vX.Y.Z -m "vX.Y.Z" && git push origin vX.Y.Z`
6. Create GitHub release with auto-generated notes:
   ```bash
   gh release create vX.Y.Z \
     dist/claude-usage-pace.user.js \
     dist/claude-usage-pace.min.user.js \
     --generate-notes
   ```
   Installed users auto-update via `@updateURL` pointing at `dist/claude-usage-pace.user.js` on `main`. The tag + release provide a stable named reference and versioned changelog.

## Pitfalls

- **Don't delete or gitignore `dist/`** — the install URL points at the raw file on `main`. Breaking the URL breaks all existing installs.
- **Don't forget to bump all three version locations** — `meta.txt`, `package.json`, and `src/userscript/main.js` must all match. Tampermonkey uses `meta.txt` for auto-update detection.
- **Don't hardcode org IDs or real API responses** — this repo is public under GPL-3.0. Captured responses in `docs/` are for reference only; never commit personal data.
- **Don't modify `meta.txt` grants or `@match` without understanding the userscript lifecycle** — the script runs at `document-start` and requires `GM_xmlhttpRequest` for polling.
- **Don't confuse session vs. weekly math** — the session bucket (`five_hour`) uses wall-clock elapsed time, not active-hours math. Weekly buckets use `activeElapsedPctOf`.
- **Don't assume MCP server is always running** — it's optional. The userscript silently no-ops on push failures and shows "MCP not detected" in the gear panel.
- **Don't rely on DOM stability** — Anthropic can change the usage page DOM at any time. The script locates rows by heading text (`Current session`, `All models`, `Sonnet only`, `Opus only`). If those strings change, the overlay won't appear.
- **Don't use `fetch` directly in the userscript** — use the patched `window.fetch` or `GM_xmlhttpRequest` to avoid CORS issues with `https://claude.ai/api/…`.
- **Don't forget to rebuild after shared code changes** — `src/common/` changes affect both the userscript and MCP server; run `bun run build` to rebuild both.

## Privacy

- **No telemetry** — neither the userscript nor the MCP server sends data to any third party.
- **Browser-only data** — the userscript only reads usage data that the Claude.ai page itself already requests; all data stays in your browser.
- **Local-only MCP server** — the optional MCP server runs entirely on your machine (`127.0.0.1:4299`). It fetches `claude.ai/api/…` using your session cookie (which you provide), and writes stats to `~/.cache/claude-pace-tracker/stats.json`. Nothing leaves your machine beyond that API call.
- **LocalStorage** — the only browser-side persistent storage is settings, under the key `__claude_pace_cfg`. No credentials or usage data are persisted there.