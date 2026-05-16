#!/usr/bin/env bash
# Prints a one-line pace summary to stderr at session start.
# Usage: register as a UserPromptSubmit / PostStart hook in ~/.claude/settings.json
STATE_FILE="${HOME}/.cache/claude-pace-tracker/state.json"
[[ -f "$STATE_FILE" ]] || exit 0

SITUATION=$(jq -r '.situation.key     // "UNKNOWN"' "$STATE_FILE" 2>/dev/null)
MESSAGE=$(jq -r   '.situation.message // ""'        "$STATE_FILE" 2>/dev/null)
PUSHED=$(jq -r    '.pushedAt          // empty'     "$STATE_FILE" 2>/dev/null)

PREFIX=""
if [[ -n "$PUSHED" ]]; then
  PUSHED_TS=$(date -j -f "%Y-%m-%dT%H:%M:%S" "${PUSHED%.*}" +%s 2>/dev/null || date -d "$PUSHED" +%s 2>/dev/null)
  NOW_TS=$(date +%s)
  if [[ -n "$PUSHED_TS" ]] && (( NOW_TS - PUSHED_TS > 1800 )); then
    PREFIX="[stale] "
  fi
fi

printf 'Pace: %s — %s%s\n' "$SITUATION" "$PREFIX" "$MESSAGE" >&2
