export function injectPaceStyles() {
  if (document.getElementById('__claude-pace-styles')) return;
  const s = document.createElement('style');
  s.id = '__claude-pace-styles';
  s.textContent =
    '.__claude-pace-pill{transition:opacity .15s;cursor:default;user-select:none}' +
    '.__claude-pace-pill:hover{opacity:.8}' +
    '.__claude-pace-pill-half{transition:filter .12s;cursor:default}' +
    '.__claude-pace-pill-half:hover{filter:brightness(1.25)}';
  document.head.appendChild(s);
}
