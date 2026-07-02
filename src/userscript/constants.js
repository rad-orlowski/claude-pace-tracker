export { ACTIVE_START_H, ACTIVE_END_H, SLEEP_START_H, NEUTRAL_BAND_PP, DAY_MS, WEEK_MS, SESSION_MS } from '../common/constants.js';
import { WEEK_MS, SESSION_MS } from '../common/constants.js';

export const BUCKET_MAP = {
  five_hour:           { title: 'Current session', periodMs: SESSION_MS },
  seven_day:           { title: 'All models',      periodMs: WEEK_MS },
  seven_day_sonnet:    { title: 'Sonnet',           periodMs: WEEK_MS },
  seven_day_fable:     { title: 'Fable',            periodMs: WEEK_MS },
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
