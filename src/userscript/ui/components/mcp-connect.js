import { getCapturedOrgId, getCookieString } from '../../capture.js';

const WARN = (...a) => console.warn('[claude-pace]', ...a);

let _statusEl  = null;
let _btnEl     = null;

function gmFetch(url, { method = 'GET', headers = {}, body = undefined, timeoutMs = 3000 } = {}) {
  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      method,
      url,
      headers,
      data: body,
      timeout: timeoutMs,
      onload:   (r) => resolve(r),
      onerror:  ()  => reject(new Error('network error')),
      ontimeout: () => reject(new Error('timeout')),
    });
  });
}

async function fetchMcpStatus(port) {
  try {
    const r = await gmFetch(`http://localhost:${port}/status`, { timeoutMs: 1500 });
    if (r.status < 200 || r.status >= 300) return null;
    return JSON.parse(r.responseText);
  } catch { return null; }
}

async function connect(port, statusEl, btnEl) {
  btnEl.disabled   = true;
  statusEl.textContent = 'Connecting…';

  const orgId = getCapturedOrgId();
  if (!orgId) {
    statusEl.textContent = '⚠ Org ID not yet captured — reload the page and try again.';
    btnEl.disabled = false;
    return;
  }

  const cookie = await getCookieString();
  if (!cookie) {
    statusEl.textContent = '⚠ Could not read cookies. Ensure Tampermonkey is installed and @grant GM_cookie is active.';
    btnEl.disabled = false;
    return;
  }

  try {
    const r = await gmFetch(`http://localhost:${port}/credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId, cookie }),
    });
    if (r.status >= 200 && r.status < 300) {
      statusEl.textContent = '✓ Connected';
      btnEl.textContent    = 'Reconnect';
    } else {
      statusEl.textContent = `⚠ Server error ${r.status}`;
    }
  } catch {
    statusEl.textContent = '⚠ MCP server not reachable — is it running?';
  }
  btnEl.disabled = false;
}

export function renderMcpSection(container, getCfg, applySettings) {
  const section = document.createElement('div');
  Object.assign(section.style, { marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px' });

  const label = document.createElement('div');
  label.textContent = 'Claude Code integration';
  Object.assign(label.style, { fontSize: '11px', fontWeight: '600', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' });
  section.appendChild(label);

  const row = document.createElement('div');
  Object.assign(row.style, { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' });

  const statusEl = document.createElement('span');
  Object.assign(statusEl.style, { fontSize: '12px', color: 'rgba(255,255,255,0.55)', flex: '1' });
  statusEl.textContent = 'Checking…';

  const btn = document.createElement('button');
  btn.textContent = 'Connect';
  Object.assign(btn.style, {
    fontSize: '11px', padding: '3px 10px', borderRadius: '4px', cursor: 'pointer',
    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
    color: 'rgba(255,255,255,0.8)',
  });

  const cfg  = getCfg();
  const port = cfg.mcpPort ?? 4299;

  btn.onclick = () => connect(port, statusEl, btn);

  row.appendChild(statusEl);
  row.appendChild(btn);
  section.appendChild(row);
  container.appendChild(section);

  fetchMcpStatus(port).then((status) => {
    if (!status) {
      statusEl.textContent = 'MCP server not running';
      return;
    }
    if (status.credentialsStatus === 'expired') {
      statusEl.textContent = '⚠ Credentials expired';
      btn.textContent = 'Reconnect';
    } else if (status.credentialsStatus === 'valid') {
      statusEl.textContent = `✓ Connected · ${status.situation ?? '…'}`;
      btn.textContent = 'Reconnect';
    } else {
      statusEl.textContent = 'Not connected';
    }
  });
}
