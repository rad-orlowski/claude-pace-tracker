// The /usage API is migrating per-model weekly data out of the legacy
// top-level `seven_day_<model>` keys (now returned as null) and into a
// `limits[]` array whose entries carry `percent`, `resets_at`, and a
// `scope.model.display_name`. This module projects `limits[]` back into the
// legacy bucket shape ({ utilization, resets_at }) the render/signals/payload
// pipeline already consumes, so the rest of the code needs no changes.
//
// Legacy top-level values win when present — they still carry float-precision
// utilization for `five_hour`/`seven_day`. `limits[]` only fills buckets the
// top level leaves null/absent (e.g. Fable, or all buckets once the top-level
// keys are fully retired). No `limits[]` array → the input is returned as-is.

/** Maps a `limits[]` entry to its legacy bucket key, or null if not graphable. */
export function keyForLimit(lim) {
	if (!lim || typeof lim !== "object") return null;
	if (lim.kind === "session") return "five_hour";
	if (lim.kind === "weekly_all") return "seven_day";
	if (lim.kind === "weekly_scoped") {
		const name = lim.scope && lim.scope.model && lim.scope.model.display_name;
		return name ? "seven_day_" + name.toLowerCase() : null;
	}
	return null;
}

export function normalizeUsage(json) {
	if (!json || typeof json !== "object" || !Array.isArray(json.limits))
		return json;
	const out = { ...json };
	for (const lim of json.limits) {
		const key = keyForLimit(lim);
		if (!key) continue;
		if (out[key] == null && lim.percent != null && lim.resets_at) {
			out[key] = { utilization: lim.percent, resets_at: lim.resets_at };
		}
	}
	return out;
}
