import { ensureLucide, makeLucideIcon, renderLucideIcons, isLucideReady } from '../lucide.js';

export const MARKER_CLASS = '__claude-pace-marker';

export function ensureMarker(host) {
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  let marker = host.querySelector('.' + MARKER_CLASS);
  if (!marker) {
    marker = document.createElement('div');
    marker.className = MARKER_CLASS;
    Object.assign(marker.style, {
      position: 'absolute', top: '-3px', bottom: '-3px', width: '2px',
      background: '#f5c542', boxShadow: '0 0 4px #f5c542', pointerEvents: 'none',
      transform: 'translateX(-1px)', zIndex: '2',
    });
    const cap = document.createElement('span');
    Object.assign(cap.style, {
      position: 'absolute', bottom: 'calc(100% + 2px)', left: '0%',
      transform: 'translateX(-50%)', fontSize: '10px', lineHeight: '1',
      color: '#f5c542', whiteSpace: 'nowrap', fontFamily: 'inherit',
      pointerEvents: 'none', display: 'inline-flex', alignItems: 'center', gap: '2px',
    });
    function populateMarkerCap() {
      cap.innerHTML = '';
      if (isLucideReady()) {
        cap.appendChild(makeLucideIcon('clock', 10));
        renderLucideIcons(cap);
      } else {
        cap.textContent = '⏱';
        ensureLucide().then(populateMarkerCap).catch(() => {});
      }
    }
    populateMarkerCap();
    marker.appendChild(cap);
    const line = document.createElement('div');
    Object.assign(line.style, {
      position: 'absolute', top: '0', bottom: '0',
      left: '50%', width: '2px',
      background: '#f5c542',
      transform: 'translateX(-1px)',
      pointerEvents: 'none', zIndex: '1',
    });
    marker.appendChild(line);
    host.appendChild(marker);
  }
  return marker;
}
