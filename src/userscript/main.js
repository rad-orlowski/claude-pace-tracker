import { installCapture } from './capture.js';
import { startPolling, stopPolling, isPolling, setLastJson, getLastJson } from './polling.js';
import { getCfg, setCfg, saveCfg } from './config.js';
import { renderAllMarkers } from './render.js';
import { ensureLucide } from './ui/lucide.js';
import { injectPaceStyles } from './ui/styles.js';
import { installLifecycle } from './lifecycle.js';
import { tryInjectGear } from './ui/components/settings.js';
import { maybeShowReconnectBanner } from './ui/components/reconnect-banner.js';

const LOG  = (...args) => console.log('[claude-pace]', ...args);
const WARN = (...args) => console.warn('[claude-pace]', ...args);

function onUsage(json) {
  if (!json || typeof json !== 'object') return;
  setLastJson(json);
  renderAllMarkers(json, getCfg());
}

function applySettings(newCfg) {
  const pollChanged = newCfg.pollIntervalMin !== getCfg().pollIntervalMin;
  setCfg(newCfg);
  saveCfg(newCfg);
  if (pollChanged) { stopPolling(); startPolling(getCfg()); }
  rerenderMarkersFromLast();
}

function rerenderMarkersFromLast() {
  tryInjectGear(getCfg, applySettings);
  const last = getLastJson();
  if (last) renderAllMarkers(last, getCfg());
}

LOG('script loaded, version 3.5.0');

installCapture(onUsage, () => {
  if (!isPolling()) startPolling(getCfg());
});

function init() {
  LOG('init() — installing UI');
  injectPaceStyles();
  ensureLucide().catch(e => WARN('Lucide load failed:', e));
  installLifecycle(
    rerenderMarkersFromLast,
    () => startPolling(getCfg()),
    stopPolling,
  );
  startPolling(getCfg());
  tryInjectGear(getCfg, applySettings);
  maybeShowReconnectBanner(getCfg().mcpPort ?? 4299);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
