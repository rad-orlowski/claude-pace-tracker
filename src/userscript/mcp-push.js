import { buildPushPayload } from "./payload.js";
import { gmFetch } from "./gm-fetch.js";
import { LOG } from "./log.js";

let _lastPushTs = 0;
let _heartbeatTimer = null;

export async function pushState(json, cfg) {
	if (cfg.mcpPushEnabled === false) return;
	const now = Date.now();
	if (now - _lastPushTs < 1000) return; // dedup re-render storms
	const payload = buildPushPayload(json, now, cfg);
	if (!payload) return;
	_lastPushTs = now;
	try {
		await gmFetch(`http://localhost:${cfg.mcpPort}/state`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});
	} catch (e) {
		LOG("mcp push skipped:", e?.message ?? e); // silent — MCP absence is fine
	}
}

export function startHeartbeat(cfg) {
	if (cfg.mcpPushEnabled === false) return;
	if (_heartbeatTimer) return;
	const tick = async () => {
		try {
			await gmFetch(`http://localhost:${cfg.mcpPort}/heartbeat`, {
				method: "POST",
			});
		} catch {
			/* intentional — heartbeat best-effort */
		}
	};
	_heartbeatTimer = setInterval(tick, 60_000);
	tick();
}

export function stopHeartbeat() {
	if (!_heartbeatTimer) return;
	clearInterval(_heartbeatTimer);
	_heartbeatTimer = null;
}
