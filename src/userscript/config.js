import { ACTIVE_START_H, ACTIVE_END_H, SLEEP_START_H } from './constants.js';

export const CFG_KEY = '__claude_pace_cfg';

export const CFG_DEFAULTS = {
  activeStartH:    ACTIVE_START_H,
  activeEndH:      ACTIVE_END_H,
  sleepStartH:     SLEEP_START_H,
  bandWeekly:      2,
  bandSession:     5,
  pollIntervalMin: 10,
  mcpPort:         4299,
};

export function loadCfg() {
  try {
    const raw = localStorage.getItem(CFG_KEY);
    if (!raw) return { ...CFG_DEFAULTS };
    return { ...CFG_DEFAULTS, ...JSON.parse(raw) };
  } catch (_) { return { ...CFG_DEFAULTS }; }
}

export function saveCfg(c) {
  try { localStorage.setItem(CFG_KEY, JSON.stringify(c)); } catch (_) {}
}

let _cfg = null;

export function getCfg() {
  if (!_cfg) _cfg = loadCfg();
  return _cfg;
}

export function setCfg(c) {
  _cfg = c;
}
