import { getCapturedOrgId, getOrgIdFromCookie } from './capture.js';

const LOG  = (...args) => console.log('[claude-pace]', ...args);
const WARN = (...args) => console.warn('[claude-pace]', ...args);

let pollTimer = null;
let lastJson  = null;

export function isPolling()         { return pollTimer !== null; }
export function getLastJson()       { return lastJson; }
export function setLastJson(json)   { lastJson = json; }

export function startPolling(cfg) {
  if (pollTimer) return;
  const orgId = getCapturedOrgId() || getOrgIdFromCookie();
  if (!orgId) { LOG('cannot start polling — orgId not yet known'); return; }
  LOG('starting /usage poll every', cfg.pollIntervalMin, 'min for org', orgId);
  pollTimer = setInterval(_pollUsage, cfg.pollIntervalMin * 60000);
  if (!lastJson) _pollUsage();
}

export function stopPolling() {
  if (!pollTimer) return;
  LOG('stopping /usage poll');
  clearInterval(pollTimer);
  pollTimer = null;
}

function _pollUsage() {
  const orgId = getCapturedOrgId();
  if (!orgId) return;
  LOG('polling /usage');
  window.fetch(`/api/organizations/${orgId}/usage`, {
    headers: { 'content-type': 'application/json', 'anthropic-client-platform': 'web_claude_ai' },
    credentials: 'include',
  }).catch((e) => { WARN('poll fetch threw:', e); });
}
