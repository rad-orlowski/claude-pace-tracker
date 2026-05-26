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
	let rerenderInterval = setInterval(onRerender, 30_000);

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

	function handleNavigation() {
		const onUsagePage = /\/settings\/usage(\b|\/)/.test(location.pathname);
		if (!onUsagePage) {
			LOG("navigated away from /settings/usage — teardown");
			teardownAll();
			clearInterval(rerenderInterval);
			clearRenderRetry();
			clearGearRetry();
			onStopPolling();
			onStopHeartbeat?.();
		} else {
			LOG("navigated onto /settings/usage");
			clearInterval(rerenderInterval);
			rerenderInterval = setInterval(onRerender, 30_000);
			onResumePolling();
			onResumeHeartbeat?.();
			onRerender();
		}
	}

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
