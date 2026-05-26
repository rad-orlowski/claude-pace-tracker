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

// ── Marker positioning ──────────────────────────────────────────

function positionMarker(marker, markerPct, band) {
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
}

// ── Pill rendering (split into window-specific helpers) ─────────

function renderSessionPill(pill, util, elapsedPct, band) {
	const dp = deltaPpOf(util, elapsedPct);
	const sev = severityOf(dp, band);
	pill.title = "Session pace vs time elapsed";
	const styles =
		sev === "over" ? PILL_OVER : sev === "under" ? PILL_UNDER : PILL_NEUTRAL;
	appendStat(pill, dirIconName(dp, band), dp);
	return styles;
}

function renderSleepPill(pill, util, markerPct) {
	const weekDp = deltaPpOf(util, markerPct);
	pill.title = "Weekly pace vs end-of-active-day target";
	appendStat(pill, "moon", weekDp);
	return {
		color: "#8899bb",
		background: "rgba(136,153,187,0.1)",
		border: "1px solid rgba(136,153,187,0.25)",
	};
}

function renderBonusPill(pill, util, markerPct, band) {
	const frozen = markerPct;
	if (util < frozen) {
		pill.title = `Below today's target — ${Math.round(frozen - util)}% to go`;
		appendStat(pill, "arrow-up-right", frozen - util);
		return {
			color: "#e8b84a",
			background: "rgba(232,184,74,0.12)",
			border: "1px solid rgba(232,184,74,0.35)",
		};
	}
	const dp = deltaPpOf(util, frozen);
	const sev = severityOf(dp, band);
	pill.title = "Weekly pace vs active-hours schedule";
	const styles = sev === "over" ? PILL_OVER : PILL_NEUTRAL;
	appendStat(pill, dirIconName(dp, band), dp);
	return styles;
}

function makePillHalf(sev, band, dp, title, side) {
	const s = sevStyle(sev);
	const half = document.createElement("span");
	half.className = "__claude-pace-pill-half";
	half.title = title;
	Object.assign(half.style, {
		display: "inline-flex",
		alignItems: "center",
		gap: "4px",
		padding: "2px 7px",
		background: s.bg,
		color: s.color,
		borderTop: `1px solid ${s.borderC}`,
		borderBottom: `1px solid ${s.borderC}`,
		borderLeft:
			side === "left" ? `1px solid ${s.borderC}` : "1px solid rgba(0,0,0,0.12)",
		borderRight:
			side === "right"
				? `1px solid ${s.borderC}`
				: "1px solid rgba(0,0,0,0.12)",
		borderRadius: side === "left" ? "999px 0 0 999px" : "0 999px 999px 0",
	});
	appendStat(half, dirIconName(dp, band), dp);
	return half;
}

function renderActivePill(
	pill,
	util,
	elapsedPct,
	now,
	resetsAtMs,
	periodMs,
	band,
	cfg,
) {
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

	Object.assign(pill.style, {
		padding: "0",
		gap: "0",
		overflow: "hidden",
		background: "none",
		border: "",
	});

	pill.appendChild(
		makePillHalf(
			weekSev,
			band,
			weekDp,
			"Weekly pace vs active-hours schedule",
			"left",
		),
	);
	pill.appendChild(
		makePillHalf(
			todaySev,
			band,
			todayDp,
			`Today's pace target (by ${cfg.activeEndH}:00)`,
			"right",
		),
	);
	if (isLucideReady()) renderLucideIcons(pill);
	return null; // no extra styles — halves have their own
}

// ── Main render ─────────────────────────────────────────────────

function renderMarkerAndPill(opts) {
	const { bucketKey, util, resetsAt, cfg } = opts;
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

	// Marker
	const markerHost = dom.barWrapper || dom.bar;
	const marker = ensureMarker(markerHost);
	if (bucketKey !== "five_hour") ensureDayDividers(markerHost, 7);
	positionMarker(marker, markerPct, band);

	// Pill
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
		styles = renderSessionPill(pill, util, elapsedPct, band);
	} else if (win === "sleep") {
		styles = renderSleepPill(pill, util, markerPct);
	} else if (win === "bonus") {
		styles = renderBonusPill(pill, util, markerPct, band);
	} else {
		styles = renderActivePill(
			pill,
			util,
			elapsedPct,
			now,
			resetsAtMs,
			periodMs,
			band,
			cfg,
		);
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
		if (
			renderMarkerAndPill({
				bucketKey: key,
				util: bucket.utilization,
				resetsAt: bucket.resets_at,
				cfg,
			})
		)
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
