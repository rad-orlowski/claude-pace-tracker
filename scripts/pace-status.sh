#!/usr/bin/env bash
# Outputs a compact pace string for Claude Code status lines.
# Usage: add $(bash /path/to/pace-status.sh) to your statusCommand in ~/.claude/settings.json
STATS_FILE="${HOME}/.cache/claude-pace-tracker/stats.json"
[[ -f "$STATS_FILE" ]] || exit 0

STATUS=$(jq -r '.credentialsStatus // "missing"' "$STATS_FILE" 2>/dev/null)
[[ "$STATUS" == "missing" ]] && exit 0

PCT=$(jq -r '.weekly.utilizationPct // empty' "$STATS_FILE" 2>/dev/null)
DP=$(jq -r '.weekly.deltaPp // empty' "$STATS_FILE" 2>/dev/null)

[[ -z "$PCT" || -z "$DP" ]] && exit 0

PCT_INT=$(printf '%.0f' "$PCT")
DP_INT=$(printf '%.0f' "$DP")

if (( DP_INT > 0 )); then ARROW="↑+${DP_INT}pp"; elif (( DP_INT < 0 )); then ARROW="↓${DP_INT}pp"; else ARROW="→"; fi
STALE=""
[[ "$STATUS" == "expired" ]] && STALE=" ⚠"

printf "~%d%% %s%s" "$PCT_INT" "$ARROW" "$STALE"
