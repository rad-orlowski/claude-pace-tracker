import { SITUATION_MESSAGES } from '../../signals.js';
import { ensureLucide, makeLucideIcon, renderLucideIcons, isLucideReady } from '../lucide.js';

export const SUMMARY_CLASS = '__claude-pace-summary';

export const SUMMARY_CATEGORY_INFO = {
  CRITICAL_LIMIT:          { colour: '#ff7a7a', icon: 'alert-triangle', fallback: '⚠' },
  RESET_TIGHT:             { colour: '#ff7a7a', icon: 'alert-triangle', fallback: '⚠' },
  RESET_OPPORTUNITY:       { colour: '#5dd28a', icon: 'gift',           fallback: '🎁' },
  SLEEP:                   { colour: '#8899bb', icon: 'moon',           fallback: '🌙' },
  BONUS_CATCH_UP:          { colour: '#e8b84a', icon: 'star',           fallback: '⭐' },
  BONUS_OK:                { colour: '#e8b84a', icon: 'star',           fallback: '⭐' },
  BOTH_WEEKLY_OVER:        { colour: '#ff7a7a', icon: 'trending-up',    fallback: '↑' },
  WEEKLY_OVER_CORRECTING:  { colour: '#f5c542', icon: 'zap',            fallback: '⚡' },
  ALL_OVER_SONNET_UNDER:   { colour: '#f5c542', icon: 'zap',            fallback: '⚡' },
  ALL_OVER:                { colour: '#ff7a7a', icon: 'trending-up',    fallback: '↑' },
  SONNET_OVER:             { colour: '#ff7a7a', icon: 'trending-up',    fallback: '↑' },
  SESSION_HOT_WEEKLY_SLACK:{ colour: '#5dd28a', icon: 'check',          fallback: '✓' },
  SESSION_HOT_DAILY_SLOW:  { colour: '#f5c542', icon: 'zap',            fallback: '⚡' },
  SESSION_HOT:             { colour: '#f5c542', icon: 'trending-up',    fallback: '↑' },
  WEEKLY_UNDER_RECOVERING: { colour: '#8aabff', icon: 'trending-down',  fallback: '↓' },
  BOTH_WEEKLY_UNDER:       { colour: '#8aabff', icon: 'trending-down',  fallback: '↓' },
  DAILY_BEHIND:            { colour: '#8aabff', icon: 'trending-down',  fallback: '↓' },
  DAILY_OK_WEEKLY_LAGGING: { colour: '#8aabff', icon: 'trending-down',  fallback: '↓' },
  SONNET_LIGHT:            { colour: '#5dd28a', icon: 'check',          fallback: '✓' },
  ALL_CLEAR:               { colour: '#5dd28a', icon: 'check',          fallback: '✓' },
};

export function renderSummaryPanel(section, key, params) {
  const msgFn = SITUATION_MESSAGES[key];
  const info  = SUMMARY_CATEGORY_INFO[key];
  if (!msgFn || !info) return;

  let wrapper = section.querySelector('.' + SUMMARY_CLASS);
  if (!wrapper) {
    wrapper = document.createElement('div');
    wrapper.className = SUMMARY_CLASS;
    Object.assign(wrapper.style, { display: 'flex', justifyContent: 'flex-end' });

    const card = document.createElement('div');
    Object.assign(card.style, {
      display: 'flex', alignItems: 'flex-start', gap: '12px',
      background: 'rgba(255,255,255,0.03)', borderRadius: '8px',
      borderLeft: `3px solid ${info.colour}`,
      padding: '10px 14px', fontSize: '14px', lineHeight: '1.5',
      flex: '1', maxWidth: '36rem',
    });

    const iconEl = document.createElement('span');
    iconEl.className = SUMMARY_CLASS + '-icon';
    Object.assign(iconEl.style, { flexShrink: '0', marginTop: '1px' });

    const body  = document.createElement('div');
    const label = document.createElement('div');
    label.className = SUMMARY_CLASS + '-label';
    label.textContent = 'PACE';
    Object.assign(label.style, {
      fontSize: '10px', fontWeight: '700', textTransform: 'uppercase',
      letterSpacing: '0.08em', marginBottom: '3px', color: info.colour,
    });

    const text = document.createElement('div');
    text.className = SUMMARY_CLASS + '-text';
    Object.assign(text.style, { color: '#c9d1d9' });

    body.appendChild(label);
    body.appendChild(text);
    card.appendChild(iconEl);
    card.appendChild(body);
    wrapper.appendChild(card);

    const ref = section.children[1];
    if (ref) section.insertBefore(wrapper, ref);
    else      section.appendChild(wrapper);
  }

  const card   = wrapper.firstElementChild;
  card.style.borderLeftColor = info.colour;

  const label = card.querySelector('.' + SUMMARY_CLASS + '-label');
  label.style.color = info.colour;

  const iconEl = card.querySelector('.' + SUMMARY_CLASS + '-icon');
  iconEl.innerHTML = '';
  if (isLucideReady()) {
    iconEl.appendChild(makeLucideIcon(info.icon, 14));
    renderLucideIcons(iconEl);
  } else {
    iconEl.textContent = info.fallback;
    ensureLucide().then(() => {
      iconEl.innerHTML = '';
      iconEl.appendChild(makeLucideIcon(info.icon, 14));
      renderLucideIcons(iconEl);
    }).catch(() => {});
  }

  card.querySelector('.' + SUMMARY_CLASS + '-text').textContent = msgFn(params);
}
