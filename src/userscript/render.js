import { BUCKET_MAP } from "./constants.js";
import {
	elapsedPctOf,
	activeElapsedPctOf,
	timeWindowOf,
	frozenExpectedPctOf,
	todayEndExpectedPctOf,
	deltaPpOf,
	severityOf,
} from "./math.js";
import { buildSignals, classifySituation } from "./signals.js";
import { applyBarGradient } from "./ui/components/bar.js";
import { ensureMarker } from "./ui/components/now-marker.js";
import { ensureDayDividers } from "./ui/components/day-dividers.js";
import {
	ensurePill,
	PILL_OVER,
	PILL_UNDER,
	PILL_NEUTRAL,
	SUPPRESS_PILL_BEFORE_MS,
	dirIconName,
	sevStyle,
} from "./ui/components/pill.js";
import { renderSummaryPanel } from "./ui/components/summary-card.js";
import { findRowByTitle, findUsageSection } from "./ui/dom.js";
import {
	makeLucideIcon,
	renderLucideIcons,
	isLucideReady,
} from "./ui/lucide.js";

let renderRetryTimer = null;
const RENDER_RETRY_MS = 100;
const RENDER_RETRY_MAX = 30;

export function clearRenderRetry() {
	clearTimeout(renderRetryTimer);
	renderRetryTimer = null;
}

function appendStat(target, iconName, value) {
	if (isLucideReady()) {
		target.appendChild(makeLucideIcon(iconName, 12));
		renderLucideIcons(target);
	}
	target.appendChild(
		document.createTextNode(" " + Math.round(Math.abs(value)) + "%"),
	);
}

function renderMarkerAndPill(bucketKey, util, resetsAt, cfg) {
	const meta = BUCKET_MAP[bucketKey];
	if (!meta) return false;
	const dom = findRowByTitle(meta.title);
	if (!dom) return false;

	const periodMs = meta.periodMs;
	const resetsAtMs = Date.parse(resetsAt);
	if (!Number.isFinite(resetsAtMs)) return false;
	const now = Date.now();
	const periodStartMs = resetsAtMs - periodMs;

	applyBarGradient(dom.bar, periodStartMs, periodMs, util, bucketKey);

	const elapsedPct =
		bucketKey === "five_hour"
			? elapsedPctOf(now, resetsAtMs, periodMs)
			: activeElapsedPctOf(
					now,
					resetsAtMs,
					periodMs,
					cfg.activeStartH,
					cfg.activeEndH,
				);
	const win = timeWindowOf(
		new Date(now),
		cfg.activeStartH,
		cfg.activeEndH,
		cfg.sleepStartH,
	);

	const band = bucketKey === "five_hour" ? cfg.bandSession : cfg.bandWeekly;

	const markerPct =
		bucketKey === "five_hour"
			? elapsedPct
			: win === "active"
				? elapsedPct
				: frozenExpectedPctOf(
						now,
						resetsAtMs,
						periodMs,
						cfg.activeStartH,
						cfg.activeEndH,
					);

	const markerHost = dom.barWrapper || dom.bar;
	const marker = ensureMarker(markerHost);
	if (bucketKey !== "five_hour") ensureDayDividers(markerHost, 7);

	const mLeft = Math.max(0, markerPct - band);
	const mRight = Math.min(100, markerPct + band);
	marker.style.left = mLeft.toFixed(2) + "%";
	marker.style.width = (mRight - mLeft).toFixed(2) + "%";
	marker.style.background = "rgba(245,197,66,0.18)";
	marker.style.boxShadow = "none";
	const lineEl = marker.querySelector("div");
	const capEl = marker.querySelector("span");
	if (mRight > mLeft) {
		const nowPct =
			(((markerPct - mLeft) / (mRight - mLeft)) * 100).toFixed(2) + "%";
		if (lineEl) lineEl.style.left = nowPct;
		if (capEl) capEl.style.left = nowPct;
	}

	const pill = ensurePill(dom.usedLabel);
	const elapsedMs = now - periodStartMs;
	if (elapsedMs < SUPPRESS_PILL_BEFORE_MS) {
		pill.style.display = "none";
		return true;
	}
	pill.style.display = "inline-flex";
	pill.textContent = "";
	Object.assign(pill.style, { padding: "2px 8px", gap: "4px", overflow: "" });
	let styles = null;

	if (bucketKey === "five_hour") {
		const dp = deltaPpOf(util, elapsedPct);
		const sev = severityOf(dp, band);
		pill.title = "Session pace vs time elapsed";
		styles =
			sev === "over" ? PILL_OVER : sev === "under" ? PILL_UNDER : PILL_NEUTRAL;
		appendStat(pill, dirIconName(dp, band), dp);
	} else if (win === "sleep") {
		const weekDp = deltaPpOf(util, markerPct);
		pill.title = "Weekly pace vs end-of-active-day target";
		styles = {
			color: "#8899bb",
			background: "rgba(136,153,187,0.1)",
			border: "1px solid rgba(136,153,187,0.25)",
		};
		appendStat(pill, "moon", weekDp);
	} else if (win === "bonus") {
		const frozen = markerPct;
		if (util < frozen) {
			pill.title = `Below today's target — ${Math.round(frozen - util)}% to go`;
			styles = {
				color: "#e8b84a",
				background: "rgba(232,184,74,0.12)",
				border: "1px solid rgba(232,184,74,0.35)",
			};
			appendStat(pill, "arrow-up-right", frozen - util);
		} else {
			const dp = deltaPpOf(util, frozen);
			const sev = severityOf(dp, band);
			pill.title = "Weekly pace vs active-hours schedule";
			styles = sev === "over" ? PILL_OVER : PILL_NEUTRAL;
			appendStat(pill, dirIconName(dp, band), dp);
		}
	} else {
		const weekDp = deltaPpOf(util, elapsedPct);
		const weekSev = severityOf(weekDp, band);
		const todayExpected = todayEndExpectedPctOf(
			now,
			resetsAtMs,
			periodMs,
			cfg.activeEndH,
		);
		const todayDp = deltaPpOf(util, todayExpected);
		const todaySev = severityOf(todayDp, band);
		const ws = sevStyle(weekSev);
		const ts = sevStyle(todaySev);

		Object.assign(pill.style, {
			padding: "0",
			gap: "0",
			overflow: "hidden",
			background: "none",
			border: "",
		});

		const lh = document.createElement("span");
		lh.className = "__claude-pace-pill-half";
		lh.title = "Weekly pace vs active-hours schedule";
		Object.assign(lh.style, {
			display: "inline-flex",
			alignItems: "center",
			gap: "4px",
			padding: "2px 7px",
			background: ws.bg,
			color: ws.color,
			borderTop: `1px solid ${ws.borderC}`,
			borderBottom: `1px solid ${ws.borderC}`,
			borderLeft: `1px solid ${ws.borderC}`,
			borderRight: "1px solid rgba(0,0,0,0.12)",
			borderRadius: "999px 0 0 999px",
		});
		appendStat(lh, dirIconName(weekDp, band), weekDp);
		pill.appendChild(lh);

		const rh = document.createElement("span");
		rh.className = "__claude-pace-pill-half";
		rh.title = `Today's pace target (by ${cfg.activeEndH}:00)`;
		Object.assign(rh.style, {
			display: "inline-flex",
			alignItems: "center",
			gap: "4px",
			padding: "2px 7px",
			background: ts.bg,
			color: ts.color,
			borderTop: `1px solid ${ts.borderC}`,
			borderBottom: `1px solid ${ts.borderC}`,
			borderRight: `1px solid ${ts.borderC}`,
			borderRadius: "0 999px 999px 0",
		});
		appendStat(rh, dirIconName(todayDp, band), todayDp);
		pill.appendChild(rh);
		if (isLucideReady()) renderLucideIcons(pill);
	}

	if (styles) Object.assign(pill.style, styles);
	return true;
}

export function renderAllMarkers(json, cfg, attempt = 0) {
	let renderedAny = false;
	for (const key of Object.keys(BUCKET_MAP)) {
		const bucket = json && json[key];
		if (!bucket || bucket.utilization == null || bucket.resets_at == null)
			continue;
		if (renderMarkerAndPill(key, bucket.utilization, bucket.resets_at, cfg))
			renderedAny = true;
	}

	const signals = buildSignals(json, Date.now(), cfg);
	if (signals) {
		const section = findUsageSection();
		if (section) {
			const { key, params } = classifySituation(signals, cfg);
			renderSummaryPanel(section, key, params);
		}
	}

	if (!renderedAny && attempt < RENDER_RETRY_MAX) {
		clearTimeout(renderRetryTimer);
		renderRetryTimer = setTimeout(
			() => renderAllMarkers(json, cfg, attempt + 1),
			RENDER_RETRY_MS,
		);
	}
}
