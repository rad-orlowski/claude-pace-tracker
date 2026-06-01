import { installCapture } from "./capture.js";
import {
	startPolling,
	stopPolling,
	isPolling,
	setLastJson,
	getLastJson,
} from "./polling.js";
import { getCfg, setCfg, saveCfg } from "./config.js";
import { renderAllMarkers } from "./render.js";
import { injectPaceStyles } from "./ui/styles.js";
import { installLifecycle } from "./lifecycle.js";
import { tryInjectGear } from "./ui/components/settings.js";
import { pushState, startHeartbeat, stopHeartbeat } from "./mcp-push.js";

import { LOG } from "./log.js";

function onUsage(json) {
	if (!json || typeof json !== "object") return;
	setLastJson(json);
	renderAllMarkers(json, getCfg());
	pushState(json, getCfg());
}

function applySettings(newCfg) {
	const prev = getCfg();
	const pollChanged = newCfg.pollIntervalMin !== prev.pollIntervalMin;
	const pushWasOn = prev.mcpPushEnabled !== false;
	const pushNowOn = newCfg.mcpPushEnabled !== false;
	setCfg(newCfg);
	saveCfg(newCfg);
	if (pollChanged) {
		stopPolling();
		startPolling(getCfg());
	}
	if (pushWasOn && !pushNowOn) stopHeartbeat();
	else if (!pushWasOn && pushNowOn) startHeartbeat(getCfg());
	rerenderMarkersFromLast();
}

function rerenderMarkersFromLast() {
	tryInjectGear(getCfg, applySettings);
	const last = getLastJson();
	if (last) renderAllMarkers(last, getCfg());
}

LOG("script loaded, version 4.1.0");

installCapture(onUsage, () => {
	if (!isPolling()) startPolling(getCfg());
});

function init() {
	LOG("init() — installing hooks");
	// The script now matches all of claude.ai (the usage view is a hash route
	// reachable from any page), so it must NOT poll, push or inject UI until the
	// usage view is actually open. installLifecycle() establishes initial state
	// and activates polling/heartbeat/render only while on #settings/usage.
	injectPaceStyles();
	installLifecycle(
		rerenderMarkersFromLast,
		() => startPolling(getCfg()),
		stopPolling,
		() => startHeartbeat(getCfg()),
		stopHeartbeat,
	);
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", init);
} else {
	init();
}
