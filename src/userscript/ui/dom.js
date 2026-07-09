import { BUCKET_MAP } from '../constants.js';

const rowCache = new Map();
const KNOWN_TITLES = new Set(Object.values(BUCKET_MAP).map(m => m.title));

export function rebuildRowCache() {
  rowCache.clear();
  for (const bar of document.querySelectorAll('[role="meter"]')) {
    const barWrapper = bar.parentElement;
    const progressContainer = barWrapper && barWrapper.parentElement;
    const row = progressContainer && progressContainer.parentElement;
    if (!row) continue;
    let title = null;
    for (const span of row.querySelectorAll('span')) {
      const t = span.textContent.trim();
      if (KNOWN_TITLES.has(t)) { title = t; break; }
    }
    if (!title) continue;
    const usedLabel = progressContainer.querySelector('span.text-right');
    if (!usedLabel) continue;
    rowCache.set(title, { row, bar, barWrapper, usedLabel });
  }
}

export function findUsageSection() {
  for (const h of document.querySelectorAll('h2, h3')) {
    if (h.textContent.includes('Plan usage limits')) {
      let el = h;
      while (el && el.tagName !== 'SECTION') el = el.parentElement;
      return (el && el.tagName === 'SECTION') ? el : null;
    }
  }
  return null;
}

export function findRowByTitle(title) {
  const cached = rowCache.get(title);
  if (cached && cached.row.isConnected) return cached;
  rebuildRowCache();
  return rowCache.get(title) || null;
}
