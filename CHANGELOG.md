# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.0.0] - 2026-05-26

### Added
- Userscript pushes pace state directly to local MCP server (replaces cookie-based polling)
- MCP server: state persistence, freshness classification, `/state` + `/heartbeat` + `/status` endpoints
- Settings panel: MCP push toggle with live connection status
- Heartbeat lifecycle: periodic keep-alive while on `/settings/usage`
- `buildPushPayload` — schema-stable payload builder for MCP push
- `classifyFreshness` pure function with warn/error thresholds

### Changed
- Removed cookie capture, `GM.cookie` grants, and reconnect banner
- MCP server rewritten around `StatePayload` + freshness model
- Replaced `/credentials` endpoint with `/state` and `/heartbeat`
- Dropped Poller module — userscript now pushes state directly

### Fixed
- Correct Bun build outfile flag
- Remove unused Opus model from data path
- Post-review gaps from MCP push-pivot final review

## [3.5.0] - 2026-05-18

### Added
- Initial public release with pace overlay on `claude.ai/settings/usage`
- Active/bonus/sleep time window classification
- Now-marker band, over/under pace pills, and situation summary card
- Configurable active hours, neutral tolerance, and polling interval
- Gear settings panel with per-setting help tooltips

[4.0.0]: https://github.com/rad-orlowski/claude-pace-tracker/releases/tag/v4.0.0
[3.5.0]: https://github.com/rad-orlowski/claude-pace-tracker/releases/tag/v3.5.0
