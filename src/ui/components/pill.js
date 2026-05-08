export const PILL_CLASS = '__claude-pace-pill';
export const SUPPRESS_PILL_BEFORE_MS = 5 * 60 * 1000;

export const PILL_OVER    = { color: '#ff7a7a', background: 'rgba(255,90,90,0.15)',   border: '1px solid rgba(255,90,90,0.35)'  };
export const PILL_UNDER   = { color: '#5dd28a', background: 'rgba(80,200,120,0.15)',  border: '1px solid rgba(80,200,120,0.35)' };
export const PILL_NEUTRAL = { color: '#aaa',    background: 'rgba(170,170,170,0.12)', border: '1px solid rgba(170,170,170,0.3)' };

export function dirIconName(dp, band) {
  if (dp >  band) return 'trending-up';
  if (dp < -band) return 'trending-down';
  return 'check';
}

export function sevStyle(sev) {
  if (sev === 'over')  return { color: '#ff7a7a', bg: 'rgba(255,90,90,0.15)',    borderC: 'rgba(255,90,90,0.35)'   };
  if (sev === 'under') return { color: '#5dd28a', bg: 'rgba(80,200,120,0.15)',   borderC: 'rgba(80,200,120,0.35)'  };
  return                      { color: '#aaa',    bg: 'rgba(170,170,170,0.12)',  borderC: 'rgba(170,170,170,0.3)'  };
}

export function ensurePill(usedLabel) {
  let pill = usedLabel.querySelector('.' + PILL_CLASS);
  if (!pill) {
    pill = document.createElement('span');
    pill.className = PILL_CLASS;
    Object.assign(pill.style, {
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      marginTop: '4px', padding: '2px 8px', borderRadius: '999px',
      fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap', lineHeight: '1.4',
    });
    usedLabel.appendChild(document.createElement('br'));
    usedLabel.appendChild(pill);
  }
  return pill;
}
