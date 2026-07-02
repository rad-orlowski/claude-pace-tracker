# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.2.0] - 2026-07-02

### Added
- Support for the **Fable** weekly usage bar — marker band, pace pill, and bar gradient, mirroring the Sonnet row
- `normalizeUsage` (`usage-normalize.js`): projects the new `/usage` `limits[]` array (where per-model weekly data — including Fable — now lives, keyed by `scope.model.display_name`) back into the legacy `seven_day_<model>` bucket shape the pipeline consumes; legacy top-level values win when present, and responses without `limits[]` pass through unchanged

### Changed
- Deduplicated period constants: `SESSION_MS` / `WEEK_MS` / `DAY_MS` in `common/constants.ts` now back `BUCKET_MAP` and the signals/payload math (removed repeated `7 * 24 * 60 * 60 * 1000` literals and local `wMs`/`sMs` aliases)
- Removed the unused `NEUTRAL_BAND_BY_KEY` map (dead code; `BUCKET_MAP` is the single source of truth for buckets)

### Fixed
- MCP `tsconfig.json` now sets `skipLibCheck` and excludes `node_modules`/`dist`, so `tsc` no longer reports errors from third-party `bun-types` declarations

## [4.1.1] - 2026-06-24

### Fixed
- Match the `Sonnet` usage row by its current heading text; DRY up the model-label constants

## [4.1.0] - 2026-06-01

### Added
- DOM testing infrastructure using Happy-DOM
- `AGENTS.md` — AI agent onboarding document

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

[4.2.0]: https://github.com/rad-orlowski/claude-pace-tracker/releases/tag/v4.2.0
[4.1.1]: https://github.com/rad-orlowski/claude-pace-tracker/releases/tag/v4.1.1
[4.1.0]: https://github.com/rad-orlowski/claude-pace-tracker/releases/tag/v4.1.0
[4.0.0]: https://github.com/rad-orlowski/claude-pace-tracker/releases/tag/v4.0.0
[3.5.0]: https://github.com/rad-orlowski/claude-pace-tracker/releases/tag/v3.5.0
