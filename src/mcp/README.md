# pace-tracker MCP server

A small MCP server that exposes Claude usage pace state to Claude Code. It does **not** poll claude.ai itself — instead, the companion Tampermonkey userscript pushes pre-computed pace state to a local HTTP sidecar on `127.0.0.1:4299` whenever you have `claude.ai/settings/usage` open.

## Setup

1. Install the userscript (Tampermonkey, GreaseMonkey, etc.) — see the repo README.
2. Build the server:
   ```bash
   cd src/mcp && bun install && bun run build
   ```
3. Add the server to `~/.claude/settings.json`:
   ```jsonc
   {
     "mcpServers": {
       "pace-tracker": {
         "command": "bun",
         "args": ["/absolute/path/to/claude-pace-tracker/src/mcp/dist/index.js"]
       }
     }
   }
   ```
4. Open `claude.ai/settings/usage` in your browser. The userscript starts pushing immediately.

## Tools

| Tool              | Returns |
|-------------------|---------|
| `get_pace_stats`  | Full pushed payload (raw `/usage` numbers + computed pace deltas + situation) and a freshness annotation. |
| `get_situation`   | Highest-priority situation message, trend enum, and a one-line freshness suffix. |

## Freshness

- **fresh** — last push within `PACE_STALE_WARN_MIN` (default 30 min)
- **stale-warning** — past warn threshold but before `PACE_STALE_ERROR_MIN` (default 120 min); tools return cached data with a warning suffix
- **stale-error** — past error threshold; tools return `isError: true` but still include the cached payload so degraded clients can render
- **no-data** — nothing pushed yet (e.g. fresh install before the userscript ran)

If the MCP server is not running, the userscript silently no-ops and the gear panel shows "MCP not detected" — MCP is fully optional.

## Env vars

| Var | Default | Meaning |
|---|---|---|
| `PACE_HTTP_PORT`        | `4299` | Port the HTTP sidecar binds (always `127.0.0.1`) |
| `PACE_STALE_WARN_MIN`   | `30`   | Minutes after which data is annotated as stale |
| `PACE_STALE_ERROR_MIN`  | `120`  | Minutes after which tools return `isError: true` |
