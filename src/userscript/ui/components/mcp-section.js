const WARN = (...a) => console.warn('[claude-pace]', ...a);

function gmFetch(url, { method = 'GET', headers = {}, body = undefined, timeoutMs = 1500 } = {}) {
  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      method, url, headers, data: body, timeout: timeoutMs,
      onload:    (r) => resolve(r),
      onerror:   () => reject(new Error('network error')),
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

function fmtAge(ms) {
  if (ms == null) return null;
  const sec = Math.max(0, Math.floor(ms / 1000));
  if (sec < 60)  return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60)  return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}

export function renderMcpSection(container, getCfg, applySettings) {
  const section = document.createElement('div');
  Object.assign(section.style, { marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px' });

  const label = document.createElement('div');
  label.textContent = 'Claude Code integration';
  Object.assign(label.style, { fontSize: '11px', fontWeight: '600', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' });
  section.appendChild(label);

  // status row
  const statusEl = document.createElement('div');
  Object.assign(statusEl.style, { fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' });
  statusEl.textContent = 'Checking…';
  section.appendChild(statusEl);

  // toggle row
  const toggleRow = document.createElement('label');
  Object.assign(toggleRow.style, { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#d1d5db', cursor: 'pointer', userSelect: 'none' });
  const toggle = document.createElement('input');
  toggle.type = 'checkbox';
  toggle.checked = getCfg().mcpPushEnabled !== false;
  toggle.onchange = () => {
    applySettings({ ...getCfg(), mcpPushEnabled: toggle.checked });
    refresh();
  };
  const toggleLbl = document.createElement('span');
  toggleLbl.textContent = 'Push pace state to local MCP server';
  toggleRow.appendChild(toggle);
  toggleRow.appendChild(toggleLbl);
  section.appendChild(toggleRow);

  container.appendChild(section);

  async function refresh() {
    const cfg = getCfg();
    if (cfg.mcpPushEnabled === false) {
      statusEl.textContent = 'MCP push disabled';
      return;
    }
    const status = await fetchMcpStatus(cfg.mcpPort);
    if (!status) { statusEl.textContent = `MCP not detected on :${cfg.mcpPort}`; return; }
    if (status.freshness === 'no-data') { statusEl.textContent = `✓ Connected to MCP · waiting for first push`; return; }
    const seen = status.lastSeenAt ? fmtAge(Date.now() - Date.parse(status.lastSeenAt)) : null;
    const data = status.lastStateAt ? fmtAge(Date.now() - Date.parse(status.lastStateAt)) : null;
    statusEl.textContent = `✓ Pushing to MCP · last state ${data}${seen ? ` · seen ${seen}` : ''}`;
  }

  refresh();
}
