export const BUCKET_MAP = {
  five_hour:           { title: 'Current session', periodMs: 5 * 60 * 60 * 1000 },
  seven_day:           { title: 'All models',      periodMs: 7 * 24 * 60 * 60 * 1000 },
  seven_day_sonnet:    { title: 'Sonnet only',     periodMs: 7 * 24 * 60 * 60 * 1000 },
  seven_day_opus:      { title: 'Opus only',       periodMs: 7 * 24 * 60 * 60 * 1000 },
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

export const NEUTRAL_BAND_PP = 5;

export const NEUTRAL_BAND_BY_KEY = {
  five_hour:        5,
  seven_day:        2,
  seven_day_sonnet: 2,
  seven_day_opus:   2,
};

export const ACTIVE_START_H = 7;
export const ACTIVE_END_H   = 20;
export const SLEEP_START_H  = 23;
