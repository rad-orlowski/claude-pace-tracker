export { ACTIVE_START_H, ACTIVE_END_H, SLEEP_START_H, NEUTRAL_BAND_PP, NEUTRAL_BAND_BY_KEY } from '../common/constants.js';

export const BUCKET_MAP = {
  five_hour:           { title: 'Current session', periodMs: 5 * 60 * 60 * 1000 },
  seven_day:           { title: 'All models',      periodMs: 7 * 24 * 60 * 60 * 1000 },
  seven_day_sonnet:    { title: 'Sonnet',           periodMs: 7 * 24 * 60 * 60 * 1000 },
};

export const PERIOD_LEN_MS = Object.fromEntries(
  Object.entries(BUCKET_MAP).map(([k, v]) => [k, v.periodMs])
);

export const TITLE_TO_KEY = Object.fromEntries(
  Object.entries(BUCKET_MAP).map(([k, v]) => [v.title, k])
);

export function titleToKey(title) {
  return TITLE_TO_KEY[title] ?? null;
}
