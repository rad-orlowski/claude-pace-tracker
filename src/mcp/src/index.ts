#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { defaultStore } from "./store.js";
import { startHttpSidecar, type SidecarState } from "./http.js";
import { classifyFreshness } from "./freshness.js";
import { WARN_AFTER_MIN, ERROR_AFTER_MIN } from "./freshness-config.js";

const HTTP_PORT = Number(process.env.PACE_HTTP_PORT ?? "4299");

const state: SidecarState = {
	lastState: null,
	lastStateAt: null,
	lastSeenAt: null,
};

export function getPaceStatsHandler(s: SidecarState = state) {
	const f = classifyFreshness({
		now: new Date(),
		lastStateAt: s.lastStateAt,
		lastSeenAt: s.lastSeenAt,
		warnAfterMin: WARN_AFTER_MIN,
		errorAfterMin: ERROR_AFTER_MIN,
	});
	const body = {
		status: {
			freshness: f.freshness,
			dataAgeMin: f.dataAgeMin,
			liveAgeSec: f.liveAgeSec,
		},
		payload: s.lastState,
	};
	const isError = f.freshness === "stale-error";
	return {
		content: [{ type: "text" as const, text: JSON.stringify(body) }],
		...(isError ? { isError: true } : {}),
	};
}

export function getSituationHandler(s: SidecarState = state) {
	const f = classifyFreshness({
		now: new Date(),
		lastStateAt: s.lastStateAt,
		lastSeenAt: s.lastSeenAt,
		warnAfterMin: WARN_AFTER_MIN,
		errorAfterMin: ERROR_AFTER_MIN,
	});
	if (f.freshness === "no-data" || !s.lastState) {
		return {
			content: [
				{
					type: "text" as const,
					text: "No data yet — open claude.ai/settings/usage to start pushing pace state.",
				},
			],
		};
	}
	const { situation } = s.lastState;
	const suffix =
		f.freshness === "stale-error"
			? `[stale: ${f.dataAgeMin}m ago — open claude.ai/settings/usage to refresh]`
			: f.freshness === "stale-warning"
				? `[stale: ${f.dataAgeMin}m ago]`
				: `[data: ${f.dataAgeMin}m ago]`;
	const text = `${situation.key}: ${situation.message}\ntrend: ${situation.trend}\n${suffix}`;
	return {
		content: [{ type: "text" as const, text }],
		...(f.freshness === "stale-error" ? { isError: true } : {}),
	};
}

async function main() {
	// hydrate from cache (preserves last-known state across MCP restarts)
	const cached = await defaultStore.loadState();
	if (cached) {
		state.lastState = cached;
		state.lastStateAt = new Date(Date.parse(cached.pushedAt));
	}

	startHttpSidecar(HTTP_PORT, defaultStore, state);

	const server = new McpServer({ name: "pace-tracker", version: "2.0.0" });
	server.tool(
		"get_pace_stats",
		"Get current Claude usage pace stats: raw /usage values, computed pace deltas, trends, and a freshness annotation.",
		{},
		async () => getPaceStatsHandler(state),
	);
	server.tool(
		"get_situation",
		"Get the highest-priority pace situation, advisory message, overall trend, and data freshness.",
		{},
		async () => getSituationHandler(state),
	);

	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error(
		`[pace-mcp] running — HTTP sidecar on :${HTTP_PORT}, warn/error: ${WARN_AFTER_MIN}m/${ERROR_AFTER_MIN}m`,
	);
}

main().catch((err) => {
	console.error("[pace-mcp] fatal:", err);
	process.exit(1);
});
