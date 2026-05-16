#!/usr/bin/env bash
# Outputs a compact pace string for Claude Code status lines.
# Usage: $(bash /path/to/pace-status.sh) inside your statusCommand.
STATE_FILE="${HOME}/.cache/claude-pace-tracker/state.json"
[[ -f "$STATE_FILE" ]] || exit 0

PCT=$(jq -r '.computed.allWeekly.utilizationPct // empty' "$STATE_FILE" 2>/dev/null)
DP=$(jq -r  '.computed.allWeekly.deltaPp        // empty' "$STATE_FILE" 2>/dev/null)
TREND=$(jq -r '.situation.trend                  // "on-track"' "$STATE_FILE" 2>/dev/null)
PUSHED=$(jq -r '.pushedAt                        // empty'     "$STATE_FILE" 2>/dev/null)

[[ -z "$PCT" || -z "$DP" ]] && exit 0

PCT_INT=$(printf '%.0f' "$PCT")
DP_INT=$(printf '%.0f' "$DP")

case "$TREND" in
  over)      ARROW="↑+${DP_INT}pp" ;;
  under)     ARROW="↓${DP_INT}pp"  ;;
  catch-up)  ARROW="↗${DP_INT}pp"  ;;
  sleep)     ARROW="☾"              ;;
  *)         ARROW="→"              ;;
esac

# Append staleness marker if pushedAt is older than 30 minutes
STALE=""
if [[ -n "$PUSHED" ]]; then
  PUSHED_TS=$(date -j -f "%Y-%m-%dT%H:%M:%S" "${PUSHED%.*}" +%s 2>/dev/null || date -d "$PUSHED" +%s 2>/dev/null)
  NOW_TS=$(date +%s)
  if [[ -n "$PUSHED_TS" ]] && (( NOW_TS - PUSHED_TS > 1800 )); then
    STALE=" ⏳"
  fi
fi

printf "~%d%% %s%s" "$PCT_INT" "$ARROW" "$STALE"
