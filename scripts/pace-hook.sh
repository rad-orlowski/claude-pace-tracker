#!/usr/bin/env bash
# Prints a one-line pace summary to stderr at session start.
# Usage: add as a PostStart hook in ~/.claude/settings.json
STATS_FILE="${HOME}/.cache/claude-pace-tracker/stats.json"
[[ -f "$STATS_FILE" ]] || exit 0

STATUS=$(jq -r '.credentialsStatus // "missing"' "$STATS_FILE" 2>/dev/null)
[[ "$STATUS" == "missing" ]] && exit 0

SITUATION=$(jq -r '.situation // "UNKNOWN"' "$STATS_FILE" 2>/dev/null)
MESSAGE=$(jq -r '.message // ""' "$STATS_FILE" 2>/dev/null)
[[ "$STATUS" == "expired" ]] && MESSAGE="[stale] $MESSAGE"

printf 'Pace: %s — %s\n' "$SITUATION" "$MESSAGE" >&2
