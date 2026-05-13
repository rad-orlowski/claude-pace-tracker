# claude-pace-tracker-mcp

A companion MCP server for [claude-pace-tracker](https://github.com/rad-orlowski/claude-pace-tracker) that gives Claude Code live access to your usage pace statistics.

## How it works

The MCP server polls the Claude usage API directly using session credentials you share once via the userscript's gear panel. Claude Code can then call `get_pace_stats` and `get_situation` tools mid-session. Optional shell scripts enable a compact status-line indicator and a session-start summary.

## Prerequisites

- [Claude Code](https://claude.ai/code) installed
- [Tampermonkey](https://www.tampermonkey.net/) with the [claude-pace-tracker userscript](https://github.com/rad-orlowski/claude-pace-tracker) installed
- [Bun](https://bun.sh/) (the server uses Bun-specific APIs; Node.js is not supported)
- `jq` (for the shell scripts)

## Installation

**1. Clone and build**

```bash
git clone https://github.com/rad-orlowski/claude-pace-tracker.git
cd claude-pace-tracker/src/mcp
bun install
bun run build
```

**2. Add to Claude Code**

Edit `~/.claude.json` and add under `mcpServers`:

```json
{
  "mcpServers": {
    "pace-tracker": {
      "command": "bun",
      "args": ["/absolute/path/to/claude-pace-tracker/src/mcp/dist/index.js"],
      "env": {
        "PACE_POLL_INTERVAL_MIN": "5",
        "PACE_HTTP_PORT": "4299"
      }
    }
  }
}
```

Replace `/absolute/path/to/claude-pace-tracker` with the actual path where you cloned the repo.

**3. Restart Claude Code**

Claude Code starts MCP servers automatically — but only on launch. Quit and reopen Claude Code (or run `/mcp` in a session to verify the server is listed and connected).

**4. Connect your credentials**

1. Open [claude.ai/settings/usage](https://claude.ai/settings/usage) in your browser.
2. Click the ⚙ gear icon next to "Plan usage limits".
3. Scroll to the **Claude Code integration** section.
4. Click **Connect**. The server is now polling your usage data.

## Usage in Claude Code sessions

Once connected, Claude Code can call these tools:

- **`get_pace_stats`** — returns full statistics: utilisation %, pace delta, situation, and whether data is stale.
- **`get_situation`** — returns just the situation key and advisory message.

## Optional: Status line indicator

Add the pace string to your Claude Code status line:

```json
{
  "statusCommand": "echo \"$(bash /path/to/claude-pace-tracker/scripts/pace-status.sh)\""
}
```

Example output: `~48% ↓-2pp` (on-pace) or `~73% ↑+8pp ⚠` (stale credentials).

## Optional: Session-start summary

Print a one-line situation summary at the start of each Claude Code session:

```json
{
  "hooks": {
    "PostStart": [
      { "type": "command", "command": "bash /path/to/claude-pace-tracker/scripts/pace-hook.sh" }
    ]
  }
}
```

## Configuration

| Env var | Default | Description |
|---|---|---|
| `PACE_POLL_INTERVAL_MIN` | `5` | How often to poll the usage API (minutes) |
| `PACE_HTTP_PORT` | `4299` | Port for the credential-receiver HTTP sidecar |

## When credentials expire

When your Claude session token expires:
- MCP tools return a clear error message with reconnect instructions.
- The status line shows a `⚠` stale warning.
- Visiting the usage page shows a **Reconnect** banner — click it to re-share credentials in one step.

## Troubleshooting

**"MCP server not running" / "MCP server not reachable"** — Claude Code starts the server on launch. If you just edited `~/.claude.json`, restart Claude Code. Check `~/.claude/logs/` for startup errors, and verify the path in `~/.claude.json` points to the built `dist/index.js`.

**Port conflict** — Change `PACE_HTTP_PORT` in both `~/.claude.json` (env) and the userscript's gear panel port field.

**"Could not read cookies"** — Ensure Tampermonkey is installed (not Violentmonkey). The `GM.cookie` API is Tampermonkey-specific.

**No data after connecting** — Wait up to `PACE_POLL_INTERVAL_MIN` minutes for the first poll, or reload the usage page (which triggers an immediate capture).
