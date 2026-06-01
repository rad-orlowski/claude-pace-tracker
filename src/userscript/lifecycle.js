import { MARKER_CLASS } from "./ui/components/now-marker.js";
import { PILL_CLASS } from "./ui/components/pill.js";
import { SUMMARY_CLASS } from "./ui/components/summary-card.js";
import { DAY_DIV_CLASS } from "./ui/components/day-dividers.js";
import { GEAR_ID, clearGearRetry } from "./ui/components/settings.js";
import { clearRenderRetry } from "./render.js";
import { MASK_CLASS } from "./ui/components/bar.js";
import { LOG } from "./log.js";

export function installLifecycle(
	onRerender,
	onResumePolling,
	onStopPolling,
	onResumeHeartbeat,
	onStopHeartbeat,
) {
	let rerenderInterval = null;
	let active = false;

	const wrapHistory = (key) => {
		const orig = history[key];
		history[key] = function () {
			const r = orig.apply(this, arguments);
			handleNavigation();
			return r;
		};
	};
	wrapHistory("pushState");
	wrapHistory("replaceState");
	window.addEventListener("popstate", handleNavigation);
	// The usage view is now a hash route (e.g. /new#settings/usage), so a
	// plain hash change — not a history nav — can open/close it.
	window.addEventListener("hashchange", handleNavigation);

	// Matches the usage view whether it lives in the hash route
	// (`…#settings/usage`) or, defensively, the path (`/settings/usage`).
	function onUsageView() {
		return (
			/(^|\/)settings\/usage\/?$/.test(location.hash.replace(/^#/, "")) ||
			/\/settings\/usage\/?$/.test(location.pathname)
		);
	}

	// Idempotent — fired by initial load, history navs, popstate and hashchange,
	// which can overlap for a single transition.
	function handleNavigation() {
		if (onUsageView()) {
			if (active) return;
			active = true;
			LOG("entered #settings/usage — activating");
			rerenderInterval = setInterval(onRerender, 30_000);
			onResumePolling();
			onResumeHeartbeat?.();
			onRerender();
		} else {
			if (!active) return;
			active = false;
			LOG("left #settings/usage — teardown");
			teardownAll();
			clearInterval(rerenderInterval);
			rerenderInterval = null;
			clearRenderRetry();
			clearGearRetry();
			onStopPolling();
			onStopHeartbeat?.();
		}
	}

	// Establish initial state — the script may load already on the usage view.
	handleNavigation();

	function teardownAll() {
		const gear = document.getElementById(GEAR_ID);
		if (gear) gear.remove();
		document
			.querySelectorAll(
				"." +
					MARKER_CLASS +
					", ." +
					PILL_CLASS +
					", ." +
					MASK_CLASS +
					", ." +
					SUMMARY_CLASS +
					", ." +
					DAY_DIV_CLASS,
			)
			.forEach((n) => n.remove());
		document.querySelectorAll('[role="progressbar"]').forEach((bar) => {
			bar.style.background = "";
			bar.style.border = "";
			bar.style.position = "";
			const fill = bar.querySelector("div");
			if (fill) fill.style.background = "";
		});
	}
}
