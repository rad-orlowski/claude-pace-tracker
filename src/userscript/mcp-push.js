import { buildPushPayload } from "./payload.js";

import { LOG } from "./log.js";

let _lastPushTs = 0;
let _heartbeatTimer = null;

function gmFetch(
	url,
	{ method = "GET", headers = {}, body = undefined, timeoutMs = 1500 } = {},
) {
	return new Promise((resolve, reject) => {
		if (typeof GM_xmlhttpRequest === "undefined") {
			reject(new Error("GM_xmlhttpRequest unavailable"));
			return;
		}
		GM_xmlhttpRequest({
			method,
			url,
			headers,
			data: body,
			timeout: timeoutMs,
			onload: (r) => resolve(r),
			onerror: () => reject(new Error("network error")),
			ontimeout: () => reject(new Error("timeout")),
		});
	});
}

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
		} catch {}
	};
	_heartbeatTimer = setInterval(tick, 60_000);
	tick();
}

export function stopHeartbeat() {
	if (!_heartbeatTimer) return;
	clearInterval(_heartbeatTimer);
	_heartbeatTimer = null;
}
