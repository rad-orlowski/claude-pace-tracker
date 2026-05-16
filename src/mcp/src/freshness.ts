export type Freshness = 'fresh' | 'stale-warning' | 'stale-error' | 'no-data';

export interface FreshnessInput {
  now:           Date;
  lastStateAt:   Date | null;
  lastSeenAt:    Date | null;
  warnAfterMin:  number;
  errorAfterMin: number;
}

export interface FreshnessResult {
  freshness:  Freshness;
  dataAgeMin: number | null;
  liveAgeSec: number | null;
}

export function classifyFreshness(input: FreshnessInput): FreshnessResult {
  const liveAgeSec = input.lastSeenAt
    ? Math.floor((input.now.getTime() - input.lastSeenAt.getTime()) / 1000)
    : null;

  if (!input.lastStateAt) {
    return { freshness: 'no-data', dataAgeMin: null, liveAgeSec };
  }
  const dataAgeMin = Math.floor((input.now.getTime() - input.lastStateAt.getTime()) / 60000);

  let freshness: Freshness;
  if (dataAgeMin >= input.errorAfterMin)      freshness = 'stale-error';
  else if (dataAgeMin >= input.warnAfterMin)  freshness = 'stale-warning';
  else                                        freshness = 'fresh';

  return { freshness, dataAgeMin, liveAgeSec };
}
