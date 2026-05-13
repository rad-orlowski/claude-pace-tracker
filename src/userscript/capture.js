const LOG  = (...args) => console.log('[claude-pace]', ...args);
const WARN = (...args) => console.warn('[claude-pace]', ...args);

const USAGE_RE = /\/api\/organizations\/([0-9a-f-]+)\/usage(\?|$)/;

let capturedOrgId = null;

export function getCapturedOrgId() { return capturedOrgId; }

export function getOrgIdFromCookie() {
  const m = document.cookie.match(/(?:^|;\s*)lastActiveOrg=([0-9a-f-]+)/);
  return m ? m[1] : null;
}

export function getCookieString() {
  return new Promise((resolve) => {
    if (typeof GM === 'undefined' || typeof GM.cookie?.list !== 'function') {
      resolve(null);
      return;
    }
    const timeout = setTimeout(() => resolve(null), 2000);
    GM.cookie.list({ url: 'https://claude.ai' }).then((cookies) => {
      clearTimeout(timeout);
      resolve(cookies.map(c => `${c.name}=${c.value}`).join('; '));
    }).catch(() => { clearTimeout(timeout); resolve(null); });
  });
}

export function installCapture(onUsage, onFirstCapture) {
  if (window.__claudeUsagePaceFetchPatched) {
    LOG('fetch already patched — skipping');
    return;
  }
  window.__claudeUsagePaceFetchPatched = true;
  LOG('patching window.fetch');

  const orig = window.fetch;
  window.fetch = function (input, init) {
    const p = orig.apply(this, arguments);
    let url = '';
    try { url = typeof input === 'string' ? input : (input && input.url) || ''; }
    catch (_) {}
    const m = url && USAGE_RE.exec(url);
    if (m) {
      if (!capturedOrgId) {
        capturedOrgId = m[1];
        LOG('captured orgId from fetch:', capturedOrgId);
        onFirstCapture?.();
      }
      LOG('observed /usage fetch', { url });
      p.then(r => {
        if (!r || !r.ok) { WARN('fetch response not OK', r && r.status); return; }
        return r.clone().json().then(d => onUsage(d));
      }).catch((e) => { WARN('failed to read /usage response:', e); });
    }
    return p;
  };
}
