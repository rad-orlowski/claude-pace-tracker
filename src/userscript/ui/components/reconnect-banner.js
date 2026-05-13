import { getCapturedOrgId, getCookieString } from '../../capture.js';

const BANNER_ID = '__claude-pace-reconnect-banner';

async function fetchMcpStatus(port) {
  try {
    const res = await fetch(`http://localhost:${port}/status`, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function reconnect(port, banner) {
  const orgId  = getCapturedOrgId();
  const cookie = await getCookieString();
  if (!orgId || !cookie) return;
  try {
    const res = await fetch(`http://localhost:${port}/credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId, cookie }),
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) banner.remove();
  } catch {}
}

export function removeBanner() {
  document.getElementById(BANNER_ID)?.remove();
}

export async function maybeShowReconnectBanner(port = 4299) {
  if (document.getElementById(BANNER_ID)) return;

  const status = await fetchMcpStatus(port);
  if (!status || status.credentialsStatus !== 'expired') return;

  const banner = document.createElement('div');
  banner.id = BANNER_ID;
  Object.assign(banner.style, {
    position: 'fixed', top: '12px', left: '50%', transform: 'translateX(-50%)',
    zIndex: '99998', background: '#7c3aed', color: '#fff',
    padding: '8px 16px', borderRadius: '8px', fontSize: '13px',
    display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
  });

  const text = document.createElement('span');
  text.textContent = 'Claude Code pace tracker credentials expired.';
  banner.appendChild(text);

  const btn = document.createElement('button');
  btn.textContent = 'Reconnect';
  Object.assign(btn.style, {
    background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '4px',
    color: '#fff', padding: '3px 10px', cursor: 'pointer', fontSize: '12px',
  });
  btn.onclick = () => reconnect(port, banner);
  banner.appendChild(btn);

  const close = document.createElement('button');
  close.textContent = '✕';
  Object.assign(close.style, { background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '14px' });
  close.onclick = () => banner.remove();
  banner.appendChild(close);

  document.body.appendChild(banner);
}
