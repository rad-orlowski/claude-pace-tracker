const LOG  = (...args) => console.log('[claude-pace]', ...args);
const WARN = (...args) => console.warn('[claude-pace]', ...args);

const USAGE_RE = /\/api\/organizations\/([0-9a-f-]+)\/usage(\?|$)/;

let capturedOrgId = null;

export function getCapturedOrgId() { return capturedOrgId; }

export function getOrgIdFromCookie() {
  const m = document.cookie.match(/(?:^|;\s*)lastActiveOrg=([0-9a-f-]+)/);
  return m ? m[1] : null;
}

function namesOf(cookieString) {
  if (!cookieString) return [];
  return cookieString.split(/;\s*/).map(p => p.split('=')[0]).filter(Boolean);
}

function logCookieList(label, cookies) {
  const names = cookies.map(c => c.name);
  LOG(`cookie diag — ${label}:`, { count: names.length, hasSessionKey: names.includes('sessionKey'), names });
}

export function getCookieString() {
  return new Promise((resolve) => {
    const detailsBasic     = { url: location.href };
    const detailsPartition = { url: location.href, partitionKey: {} };
    const format           = (cookies) => cookies.map(c => `${c.name}=${c.value}`).join('; ');

    const docNames = namesOf(document.cookie || '');
    LOG('cookie diag — document.cookie:', { count: docNames.length, hasSessionKey: docNames.includes('sessionKey'), names: docNames });

    // Modern promise-based API (@grant GM.cookie)
    if (typeof GM !== 'undefined' && typeof GM.cookie?.list === 'function') {
      const timeout = setTimeout(() => { LOG('cookie diag — GM.cookie.list timed out'); resolve(null); }, 3000);

      Promise.all([
        GM.cookie.list(detailsBasic).then(c => c || []).catch(() => []),
        GM.cookie.list(detailsPartition).then(c => c || []).catch(() => []),
      ]).then(([basic, partitioned]) => {
        clearTimeout(timeout);
        logCookieList('GM.cookie.list { url }', basic);
        logCookieList('GM.cookie.list { url, partitionKey:{} }', partitioned);

        // Merge by cookie name — prefer the variant that returned sessionKey if either does.
        const merged = new Map();
        for (const c of basic)       merged.set(c.name, c);
        for (const c of partitioned) merged.set(c.name, c);
        const all = [...merged.values()];
        logCookieList('GM.cookie.list (merged)', all);
        resolve(format(all) || null);
      });
      return;
    }

    // Legacy callback-based API (@grant GM_cookie)
    if (typeof GM_cookie !== 'undefined' && typeof GM_cookie.list === 'function') {
      const timeout = setTimeout(() => { LOG('cookie diag — GM_cookie.list timed out'); resolve(null); }, 3000);
      GM_cookie.list(detailsBasic, (c, err) => {
        clearTimeout(timeout);
        if (err) { LOG('cookie diag — GM_cookie.list error:', err); resolve(null); return; }
        logCookieList('GM_cookie.list { url }', c || []);
        resolve(format(c || []) || null);
      });
      return;
    }

    LOG('cookie diag — no GM.cookie / GM_cookie available');
    resolve(null);
  });
}

export function installCapture(onUsage, onFirstCapture) {
  const UW = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  if (UW.__claudeUsagePaceFetchPatched) {
    LOG('fetch already patched — skipping');
    return;
  }
  UW.__claudeUsagePaceFetchPatched = true;
  LOG('patching window.fetch');

  const orig = UW.fetch.bind(UW);
  UW.fetch = function (input, init) {
    const p = orig.apply(UW, arguments);
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
