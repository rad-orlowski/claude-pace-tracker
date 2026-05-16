import { CFG_DEFAULTS } from '../../config.js';
import { ensureLucide, makeLucideIcon, renderLucideIcons, isLucideReady } from '../lucide.js';
import { renderMcpSection } from './mcp-section.js';

export const GEAR_ID  = '__claude-pace-gear';
export const PANEL_ID = '__claude-pace-panel';

let _gearRetryTimer = null;

export function tryInjectGear(getCfg, applySettings, attempt = 0) {
  if (_injectSettingsGear(getCfg, applySettings) || attempt >= 50) return;
  clearTimeout(_gearRetryTimer);
  _gearRetryTimer = setTimeout(() => tryInjectGear(getCfg, applySettings, attempt + 1), 100);
}

function _injectSettingsGear(getCfg, applySettings) {
  if (document.getElementById(GEAR_ID)) return true;
  let anchor = null;
  for (const h of document.querySelectorAll('h2, h3')) {
    if (h.textContent.includes('Plan usage limits')) {
      anchor = h.querySelector('span') || h;
      break;
    }
  }
  if (!anchor) return false;
  const btn = document.createElement('button');
  btn.id = GEAR_ID;
  btn.title = 'Pace indicator settings';
  Object.assign(btn.style, {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'rgba(170,170,170,0.45)', padding: '2px 4px', borderRadius: '4px',
    marginLeft: '8px', transition: 'color .15s', verticalAlign: 'middle',
    flexShrink: '0',
  });
  btn.onmouseenter = () => { btn.style.color = 'rgba(200,200,200,0.9)'; };
  btn.onmouseleave = () => { btn.style.color = 'rgba(170,170,170,0.45)'; };
  btn.onclick = e => { e.stopPropagation(); openSettingsPanel(getCfg(), applySettings); };
  if (isLucideReady()) {
    btn.appendChild(makeLucideIcon('settings', 14));
    renderLucideIcons(btn);
  } else {
    btn.textContent = '⚙';
    ensureLucide().then(() => {
      btn.textContent = '';
      btn.appendChild(makeLucideIcon('settings', 14));
      renderLucideIcons(btn);
    }).catch(() => {});
  }
  anchor.appendChild(btn);
  return true;
}

export function openSettingsPanel(cfg, applySettings) {
  if (document.getElementById(PANEL_ID)) return;

  const overlay = document.createElement('div');
  overlay.id = PANEL_ID;
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0', zIndex: '99999',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)',
  });

  const panel = document.createElement('div');
  Object.assign(panel.style, {
    background: '#1a1d24', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px', padding: '20px 24px', minWidth: '340px',
    boxShadow: '0 8px 40px rgba(0,0,0,0.6)', fontFamily: 'inherit',
    color: '#e5e7eb',
  });

  const hdr = document.createElement('div');
  Object.assign(hdr.style, {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: '16px',
  });
  const hdrTitle = document.createElement('div');
  Object.assign(hdrTitle.style, { fontSize: '14px', fontWeight: '600', color: '#f9fafb' });
  hdrTitle.textContent = 'Pace indicator settings';
  const hdrClose = document.createElement('button');
  Object.assign(hdrClose.style, {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#6b7280', fontSize: '18px', lineHeight: '1', padding: '0 2px',
  });
  hdrClose.textContent = '×';
  hdr.appendChild(hdrTitle);
  hdr.appendChild(hdrClose);
  panel.appendChild(hdr);

  function addSection(label) {
    const sec = document.createElement('div');
    Object.assign(sec.style, { marginBottom: '14px' });
    const lbl = document.createElement('div');
    Object.assign(lbl.style, {
      fontSize: '10px', fontWeight: '700', color: '#6b7280',
      textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px',
    });
    lbl.textContent = label;
    sec.appendChild(lbl);
    panel.appendChild(sec);
    return sec;
  }

  const inputs = {};
  function addRow(parent, key, label, value, min, max, unit, helpText) {
    const row = document.createElement('div');
    Object.assign(row.style, {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: '8px', marginBottom: '6px',
    });
    const lblWrap = document.createElement('div');
    Object.assign(lblWrap.style, { display: 'flex', alignItems: 'center', gap: '5px' });
    const lbl = document.createElement('label');
    lbl.htmlFor = '__cpace_' + key;
    Object.assign(lbl.style, { fontSize: '13px', color: '#d1d5db', cursor: 'default' });
    lbl.textContent = label;
    lblWrap.appendChild(lbl);
    if (helpText) {
      const icon = document.createElement('span');
      icon.textContent = '?';
      Object.assign(icon.style, {
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: '14px', height: '14px', borderRadius: '50%',
        border: '1px solid rgba(255,255,255,0.18)', color: '#6b7280',
        fontSize: '9px', fontWeight: '700', cursor: 'help',
        flexShrink: '0', position: 'relative', userSelect: 'none',
        transition: 'color .12s, border-color .12s, background .12s',
      });
      const tip = document.createElement('div');
      Object.assign(tip.style, {
        position: 'absolute', left: '50%', bottom: 'calc(100% + 6px)',
        transform: 'translateX(-50%)',
        background: '#252836', border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: '7px', padding: '7px 10px', fontSize: '11px',
        color: '#c9d1d9', width: '210px', lineHeight: '1.5',
        boxShadow: '0 4px 16px rgba(0,0,0,0.45)',
        zIndex: '2', pointerEvents: 'none', display: 'none', whiteSpace: 'normal',
      });
      tip.textContent = helpText;
      icon.appendChild(tip);
      icon.onmouseenter = () => {
        tip.style.display = 'block';
        icon.style.color = '#c9d1d9';
        icon.style.borderColor = 'rgba(255,255,255,0.5)';
        icon.style.background = 'rgba(255,255,255,0.08)';
      };
      icon.onmouseleave = () => {
        tip.style.display = 'none';
        icon.style.color = '#6b7280';
        icon.style.borderColor = 'rgba(255,255,255,0.18)';
        icon.style.background = '';
      };
      lblWrap.appendChild(icon);
    }
    const right = document.createElement('div');
    Object.assign(right.style, { display: 'flex', alignItems: 'center', gap: '5px' });
    const inp = document.createElement('input');
    inp.type = 'number'; inp.id = '__cpace_' + key;
    inp.value = value; inp.min = min; inp.max = max;
    Object.assign(inp.style, {
      width: '54px', padding: '3px 6px', borderRadius: '6px',
      border: '1px solid rgba(255,255,255,0.12)',
      background: 'rgba(255,255,255,0.06)',
      color: '#f9fafb', fontSize: '13px', textAlign: 'center',
    });
    const unitEl = document.createElement('span');
    Object.assign(unitEl.style, { fontSize: '12px', color: '#6b7280', minWidth: '36px' });
    unitEl.textContent = unit;
    right.appendChild(inp);
    right.appendChild(unitEl);
    row.appendChild(lblWrap);
    row.appendChild(right);
    parent.appendChild(row);
    inputs[key] = inp;
  }

  const s1 = addSection('Active window');
  addRow(s1, 'activeStartH',    'Start hour',         cfg.activeStartH,    0, 23, 'h (0–23)',
    'Hour when your coding day begins. Before this, no tokens are expected — the pace clock starts here each day.');
  addRow(s1, 'activeEndH',      'End / bonus starts', cfg.activeEndH,      0, 23, 'h (0–23)',
    'Hour when the active window closes and the bonus window begins. The daily target badge shows whether you\'re on pace by this hour.');
  addRow(s1, 'sleepStartH',     'Sleep starts',       cfg.sleepStartH,     0, 23, 'h (0–23)',
    'Hour when the bonus window ends and sleep begins. Pace expectations freeze during sleep — you\'re not expected to use tokens overnight.');

  const s2 = addSection('Neutral tolerance');
  addRow(s2, 'bandWeekly',      'Weekly buckets',     cfg.bandWeekly,      0, 20, '%pp ±',
    'How many percentage points off from the expected weekly pace before the badge turns red or green. Wider = more forgiving.');
  addRow(s2, 'bandSession',     'Session (5h)',       cfg.bandSession,     0, 20, '%pp ±',
    'Same tolerance for the 5-hour session bucket, which resets more often and naturally varies more than the weekly view.');

  const s3 = addSection('Polling');
  addRow(s3, 'pollIntervalMin', 'Check interval',     cfg.pollIntervalMin, 1, 120, 'min',
    'How often the script re-fetches usage data from Claude\'s API in the background. Lower = more up to date, higher = fewer requests.');

  renderMcpSection(panel, () => cfg, applySettings);

  const sep = document.createElement('div');
  Object.assign(sep.style, { borderTop: '1px solid rgba(255,255,255,0.08)', margin: '16px 0 14px' });
  panel.appendChild(sep);

  const footer = document.createElement('div');
  Object.assign(footer.style, { display: 'flex', gap: '8px', justifyContent: 'flex-end' });

  function mkBtn(label, primary, danger) {
    const b = document.createElement('button');
    b.textContent = label;
    Object.assign(b.style, {
      padding: '5px 13px', borderRadius: '6px', fontSize: '12px', fontWeight: '600',
      cursor: 'pointer', border: 'none', transition: 'opacity .12s',
      background: primary ? '#3b5bdb' : danger ? 'rgba(255,90,90,0.15)' : 'rgba(255,255,255,0.08)',
      color: primary ? '#fff' : danger ? '#ff7a7a' : '#9ca3af',
    });
    b.onmouseenter = () => { b.style.opacity = '0.75'; };
    b.onmouseleave = () => { b.style.opacity = '1'; };
    return b;
  }

  const resetBtn  = mkBtn('Reset defaults', false, true);
  const cancelBtn = mkBtn('Cancel');
  const saveBtn   = mkBtn('Save', true);

  function close() {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', onKey);
  hdrClose.onclick = close;
  cancelBtn.onclick = close;
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  resetBtn.onclick = () => {
    for (const [k, inp] of Object.entries(inputs)) inp.value = CFG_DEFAULTS[k];
  };
  saveBtn.onclick = () => {
    const newCfg = {};
    for (const [k, inp] of Object.entries(inputs)) {
      const def = CFG_DEFAULTS[k];
      newCfg[k] = Math.min(Math.max(parseInt(inp.value, 10) || def, +inp.min), +inp.max);
    }
    applySettings(newCfg);
    close();
  };

  footer.appendChild(resetBtn);
  footer.appendChild(cancelBtn);
  footer.appendChild(saveBtn);
  panel.appendChild(footer);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
}
