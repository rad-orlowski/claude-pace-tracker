import { test, expect } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeStore } from "../src/store";
import { startHttpSidecar, type SidecarState } from "../src/http";
import type { StatePayload } from "../src/payload";

const PORT = 14299;

function makeState(): SidecarState {
	return { lastState: null, lastStateAt: null, lastSeenAt: null };
}

async function setup() {
	const dir = await mkdtemp(join(tmpdir(), "pace-http-"));
	const store = makeStore(join(dir, "state.json"));
	const state = makeState();
	const server = startHttpSidecar(PORT, store, state);
	return { dir, store, state, server };
}

const sample: StatePayload = {
	schemaVersion: 1,
	pushedAt: "2026-05-16T14:00:00.000Z",
	raw: {
		seven_day: { utilization: 40, resets_at: "2026-05-23T00:00:00.000Z" },
		seven_day_sonnet: {
			utilization: 35,
			resets_at: "2026-05-23T00:00:00.000Z",
		},
		five_hour: { utilization: 20, resets_at: "2026-05-16T18:00:00.000Z" },
	},
	computed: {
		window: "active",
		resetInH: 71,
		daysLeft: 3,
		session: {
			utilizationPct: 20,
			deltaPp: -2,
			elapsedPct: 22,
			trend: "on-track",
		},
		allWeekly: {
			utilizationPct: 40,
			deltaPp: 4,
			elapsedPct: 36,
			trend: "over",
		},
		allDaily: { deltaPp: 1, trend: "on-track" },
		sonnetWeekly: {
			utilizationPct: 35,
			deltaPp: -1,
			elapsedPct: 36,
			trend: "on-track",
		},
		sonnetDaily: { deltaPp: 0, trend: "on-track" },
	},
	situation: {
		key: "ALL_OVER",
		params: { allWDp: 4 },
		message: "Test.",
		trend: "over",
	},
};

test("POST /state — stores payload and updates timestamps", async () => {
	const { dir, store, state, server } = await setup();
	const res = await fetch(`http://localhost:${PORT}/state`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(sample),
	});
	expect(res.status).toBe(200);
	expect(state.lastState?.situation.key).toBe("ALL_OVER");
	expect(state.lastStateAt).not.toBeNull();
	expect(state.lastSeenAt).not.toBeNull();
	expect(await store.loadState()).not.toBeNull();
	server.stop(true);
	await rm(dir, { recursive: true, force: true });
});

test("POST /state — rejects malformed payload", async () => {
	const { dir, server } = await setup();
	const res = await fetch(`http://localhost:${PORT}/state`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ schemaVersion: 99 }),
	});
	expect(res.status).toBe(400);
	server.stop(true);
	await rm(dir, { recursive: true, force: true });
});

test("POST /heartbeat — updates lastSeenAt but not lastStateAt", async () => {
	const { dir, state, server } = await setup();
	const before = state.lastStateAt;
	const res = await fetch(`http://localhost:${PORT}/heartbeat`, {
		method: "POST",
	});
	expect(res.status).toBe(200);
	expect(state.lastSeenAt).not.toBeNull();
	expect(state.lastStateAt).toBe(before); // null in this setup
	server.stop(true);
	await rm(dir, { recursive: true, force: true });
});

test("GET /status — reports lastStateAt, lastSeenAt, freshness, situation", async () => {
	const { dir, state, server } = await setup();
	state.lastState = sample;
	state.lastStateAt = new Date();
	state.lastSeenAt = new Date();
	const res = await fetch(`http://localhost:${PORT}/status`);
	const body = await res.json();
	expect(body.connected).toBe(true);
	expect(body.lastStateAt).toBeTruthy();
	expect(body.lastSeenAt).toBeTruthy();
	expect(body.freshness).toBe("fresh");
	expect(body.situation).toBe("ALL_OVER");
	server.stop(true);
	await rm(dir, { recursive: true, force: true });
});

test("GET /status — reports no-data when nothing pushed yet", async () => {
	const { dir, server } = await setup();
	const res = await fetch(`http://localhost:${PORT}/status`);
	const body = await res.json();
	expect(body.freshness).toBe("no-data");
	expect(body.lastStateAt).toBeNull();
	server.stop(true);
	await rm(dir, { recursive: true, force: true });
});
