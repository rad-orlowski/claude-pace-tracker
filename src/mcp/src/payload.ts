export const SCHEMA_VERSION = 1;

export type Trend = 'over' | 'under' | 'on-track' | 'sleep' | 'catch-up';
export type TimeWindow = 'active' | 'bonus' | 'sleep';

export interface RawBucket {
  utilization: number;
  resets_at:   string;
}

export interface ComputedBucket {
  utilizationPct: number;
  deltaPp:        number;
  elapsedPct:     number;
  trend:          Trend;
}

export interface ComputedDailyBucket {
  deltaPp: number;
  trend:   Trend;
}

export interface StatePayload {
  schemaVersion: number;
  pushedAt:      string;
  raw: {
    seven_day:        RawBucket;
    seven_day_sonnet: RawBucket;
    five_hour:        RawBucket;
  };
  computed: {
    window:       TimeWindow;
    resetInH:     number;
    daysLeft:     number;
    session:      ComputedBucket;
    allWeekly:    ComputedBucket;
    allDaily:     ComputedDailyBucket;
    sonnetWeekly: ComputedBucket;
    sonnetDaily:  ComputedDailyBucket;
  };
  situation: {
    key:     string;
    params:  Record<string, unknown>;
    message: string;
    trend:   Trend;
  };
}

const TRENDS: ReadonlySet<Trend> = new Set(['over', 'under', 'on-track', 'sleep', 'catch-up']);

function isRawBucket(x: unknown): x is RawBucket {
  return !!x && typeof x === 'object'
    && typeof (x as any).utilization === 'number'
    && typeof (x as any).resets_at   === 'string';
}

export function isValidStatePayload(x: unknown): x is StatePayload {
  if (!x || typeof x !== 'object') return false;
  const p = x as Partial<StatePayload>;
  if (p.schemaVersion !== SCHEMA_VERSION) return false;
  if (typeof p.pushedAt !== 'string') return false;
  if (!p.raw || !isRawBucket(p.raw.seven_day) || !isRawBucket(p.raw.seven_day_sonnet)
              || !isRawBucket(p.raw.five_hour)) return false;
  if (!p.computed) return false;
  if (!p.situation || typeof p.situation.message !== 'string' || !TRENDS.has(p.situation.trend as Trend)) return false;
  return true;
}
