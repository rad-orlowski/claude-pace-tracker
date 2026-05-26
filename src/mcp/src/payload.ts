export const SCHEMA_VERSION = 1;

export type Trend = "over" | "under" | "on-track" | "sleep" | "catch-up";
export type TimeWindow = "active" | "bonus" | "sleep";

export interface RawBucket {
	utilization: number;
	resets_at: string;
}

export interface ComputedBucket {
	utilizationPct: number;
	deltaPp: number;
	elapsedPct: number;
	trend: Trend;
}

export interface ComputedDailyBucket {
	deltaPp: number;
	trend: Trend;
}

export interface StatePayload {
	schemaVersion: number;
	pushedAt: string;
	raw: {
		seven_day: RawBucket;
		seven_day_sonnet: RawBucket;
		five_hour: RawBucket;
	};
	computed: {
		window: TimeWindow;
		resetInH: number;
		daysLeft: number;
		session: ComputedBucket;
		allWeekly: ComputedBucket;
		allDaily: ComputedDailyBucket;
		sonnetWeekly: ComputedBucket;
		sonnetDaily: ComputedDailyBucket;
	};
	situation: {
		key: string;
		params: Record<string, unknown>;
		message: string;
		trend: Trend;
	};
}

const TRENDS: ReadonlySet<Trend> = new Set([
	"over",
	"under",
	"on-track",
	"sleep",
	"catch-up",
]);

function isRawBucket(x: unknown): x is RawBucket {
	return (
		!!x &&
		typeof x === "object" &&
		typeof (x as any).utilization === "number" &&
		typeof (x as any).resets_at === "string"
	);
}

function hasAllRawBuckets(raw: unknown): boolean {
	if (!raw || typeof raw !== "object") return false;
	const r = raw as Record<string, unknown>;
	return (
		isRawBucket(r.seven_day) &&
		isRawBucket(r.seven_day_sonnet) &&
		isRawBucket(r.five_hour)
	);
}

function isValidSituation(sit: unknown): boolean {
	if (!sit || typeof sit !== "object") return false;
	const s = sit as Record<string, unknown>;
	return typeof s.message === "string" && TRENDS.has(s.trend as Trend);
}

export function isValidStatePayload(x: unknown): x is StatePayload {
	if (!x || typeof x !== "object") return false;
	const p = x as Partial<StatePayload>;
	return (
		p.schemaVersion === SCHEMA_VERSION &&
		typeof p.pushedAt === "string" &&
		hasAllRawBuckets(p.raw) &&
		!!p.computed &&
		isValidSituation(p.situation)
	);
}
