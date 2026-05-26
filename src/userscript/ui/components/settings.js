import { CFG_DEFAULTS } from "../../config.js";
import {
	ensureLucide,
	makeLucideIcon,
	renderLucideIcons,
	isLucideReady,
} from "../lucide.js";
import { renderMcpSection } from "./mcp-section.js";

export const GEAR_ID = "__claude-pace-gear";
export const PANEL_ID = "__claude-pace-panel";

let _gearRetryTimer = null;

export function tryInjectGear(getCfg, applySettings, attempt = 0) {
	if (_injectSettingsGear(getCfg, applySettings) || attempt >= 50) return;
	clearTimeout(_gearRetryTimer);
	_gearRetryTimer = setTimeout(
		() => tryInjectGear(getCfg, applySettings, attempt + 1),
		100,
	);
}

export function clearGearRetry() {
	clearTimeout(_gearRetryTimer);
	_gearRetryTimer = null;
}

// ── Style constants ─────────────────────────────────────────────

const S = {
	overlay: {
		position: "fixed",
		inset: "0",
		zIndex: "99999",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		background: "rgba(0,0,0,0.55)",
		backdropFilter: "blur(2px)",
	},
	panel: {
		background: "#1a1d24",
		border: "1px solid rgba(255,255,255,0.1)",
		borderRadius: "12px",
		padding: "20px 24px",
		minWidth: "340px",
		boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
		fontFamily: "inherit",
		color: "#e5e7eb",
	},
	header: {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: "16px",
	},
	headerTitle: { fontSize: "14px", fontWeight: "600", color: "#f9fafb" },
	closeBtn: {
		background: "none",
		border: "none",
		cursor: "pointer",
		color: "#6b7280",
		fontSize: "18px",
		lineHeight: "1",
		padding: "0 2px",
	},
	sectionLabel: {
		fontSize: "10px",
		fontWeight: "700",
		color: "#6b7280",
		textTransform: "uppercase",
		letterSpacing: "0.07em",
		marginBottom: "8px",
	},
	row: {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		gap: "8px",
		marginBottom: "6px",
	},
	labelWrap: { display: "flex", alignItems: "center", gap: "5px" },
	label: { fontSize: "13px", color: "#d1d5db", cursor: "default" },
	input: {
		width: "54px",
		padding: "3px 6px",
		borderRadius: "6px",
		border: "1px solid rgba(255,255,255,0.12)",
		background: "rgba(255,255,255,0.06)",
		color: "#f9fafb",
		fontSize: "13px",
		textAlign: "center",
	},
	unit: { fontSize: "12px", color: "#6b7280", minWidth: "36px" },
	sep: { borderTop: "1px solid rgba(255,255,255,0.08)", margin: "16px 0 14px" },
	footer: { display: "flex", gap: "8px", justifyContent: "flex-end" },
	helpIcon: {
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
		width: "14px",
		height: "14px",
		borderRadius: "50%",
		border: "1px solid rgba(255,255,255,0.18)",
		color: "#6b7280",
		fontSize: "9px",
		fontWeight: "700",
		cursor: "help",
		flexShrink: "0",
		position: "relative",
		userSelect: "none",
		transition: "color .12s, border-color .12s, background .12s",
	},
	helpTip: {
		position: "absolute",
		left: "50%",
		bottom: "calc(100% + 6px)",
		transform: "translateX(-50%)",
		background: "#252836",
		border: "1px solid rgba(255,255,255,0.15)",
		borderRadius: "7px",
		padding: "7px 10px",
		fontSize: "11px",
		color: "#c9d1d9",
		width: "210px",
		lineHeight: "1.5",
		boxShadow: "0 4px 16px rgba(0,0,0,0.45)",
		zIndex: "2",
		pointerEvents: "none",
		display: "none",
		whiteSpace: "normal",
	},
};

// ── DOM builders ────────────────────────────────────────────────

function el(tag, styles, text) {
	const e = document.createElement(tag);
	if (styles) Object.assign(e.style, styles);
	if (text) e.textContent = text;
	return e;
}

function mkBtn(label, primary, danger) {
	const b = el(
		"button",
		{
			padding: "5px 13px",
			borderRadius: "6px",
			fontSize: "12px",
			fontWeight: "600",
			cursor: "pointer",
			border: "none",
			transition: "opacity .12s",
			background: primary
				? "#3b5bdb"
				: danger
					? "rgba(255,90,90,0.15)"
					: "rgba(255,255,255,0.08)",
			color: primary ? "#fff" : danger ? "#ff7a7a" : "#9ca3af",
		},
		label,
	);
	b.onmouseenter = () => {
		b.style.opacity = "0.75";
	};
	b.onmouseleave = () => {
		b.style.opacity = "1";
	};
	return b;
}

function addHelpIcon(parent, helpText) {
	const icon = el("span", S.helpIcon, "?");
	const tip = el("div", S.helpTip, helpText);
	icon.appendChild(tip);
	icon.onmouseenter = () => {
		tip.style.display = "block";
		Object.assign(icon.style, {
			color: "#c9d1d9",
			borderColor: "rgba(255,255,255,0.5)",
			background: "rgba(255,255,255,0.08)",
		});
	};
	icon.onmouseleave = () => {
		tip.style.display = "none";
		Object.assign(icon.style, {
			color: "#6b7280",
			borderColor: "rgba(255,255,255,0.18)",
			background: "",
		});
	};
	parent.appendChild(icon);
}

function addSection(panel, label) {
	const sec = el("div", { marginBottom: "14px" });
	sec.appendChild(el("div", S.sectionLabel, label));
	panel.appendChild(sec);
	return sec;
}

function addRow(parent, inputs, key, label, value, min, max, unit, helpText) {
	const row = el("div", S.row);
	const lblWrap = el("div", S.labelWrap);
	lblWrap.appendChild(el("label", S.label, label));
	if (helpText) addHelpIcon(lblWrap, helpText);
	row.appendChild(lblWrap);

	const right = el("div", {
		display: "flex",
		alignItems: "center",
		gap: "5px",
	});
	const inp = el("input", S.input);
	inp.type = "number";
	inp.id = "__cpace_" + key;
	inp.value = value;
	inp.min = min;
	inp.max = max;
	right.appendChild(inp);
	right.appendChild(el("span", S.unit, unit));
	row.appendChild(right);
	parent.appendChild(row);
	inputs[key] = inp;
}

// ── Gear injection ──────────────────────────────────────────────

function _injectSettingsGear(getCfg, applySettings) {
	if (document.getElementById(GEAR_ID)) return true;
	let anchor = null;
	for (const h of document.querySelectorAll("h2, h3")) {
		if (h.textContent.includes("Plan usage limits")) {
			anchor = h.querySelector("span") || h;
			break;
		}
	}
	if (!anchor) return false;

	const btn = el("button", {
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
		background: "none",
		border: "none",
		cursor: "pointer",
		color: "rgba(170,170,170,0.45)",
		padding: "2px 4px",
		borderRadius: "4px",
		marginLeft: "8px",
		transition: "color .15s",
		verticalAlign: "middle",
		flexShrink: "0",
	});
	btn.id = GEAR_ID;
	btn.title = "Pace indicator settings";
	btn.onmouseenter = () => {
		btn.style.color = "rgba(200,200,200,0.9)";
	};
	btn.onmouseleave = () => {
		btn.style.color = "rgba(170,170,170,0.45)";
	};
	btn.onclick = (e) => {
		e.stopPropagation();
		openSettingsPanel(getCfg(), applySettings);
	};

	if (isLucideReady()) {
		btn.appendChild(makeLucideIcon("settings", 14));
		renderLucideIcons(btn);
	} else {
		btn.textContent = "⚙";
		ensureLucide()
			.then(() => {
				btn.textContent = "";
				btn.appendChild(makeLucideIcon("settings", 14));
				renderLucideIcons(btn);
			})
			.catch(() => {});
	}
	anchor.appendChild(btn);
	return true;
}

// ── Settings panel ──────────────────────────────────────────────

export function openSettingsPanel(cfg, applySettings) {
	if (document.getElementById(PANEL_ID)) return;

	const overlay = el("div", S.overlay);
	overlay.id = PANEL_ID;
	const panel = el("div", S.panel);

	// Header
	const hdr = el("div", S.header);
	hdr.appendChild(el("div", S.headerTitle, "Pace indicator settings"));
	const hdrClose = el("button", S.closeBtn, "×");
	hdr.appendChild(hdrClose);
	panel.appendChild(hdr);

	// Sections + inputs
	const inputs = {};
	const s1 = addSection(panel, "Active window");
	addRow(
		s1,
		inputs,
		"activeStartH",
		"Start hour",
		cfg.activeStartH,
		0,
		23,
		"h (0–23)",
		"Hour when your coding day begins. Before this, no tokens are expected — the pace clock starts here each day.",
	);
	addRow(
		s1,
		inputs,
		"activeEndH",
		"End / bonus starts",
		cfg.activeEndH,
		0,
		23,
		"h (0–23)",
		"Hour when the active window closes and the bonus window begins. The daily target badge shows whether you're on pace by this hour.",
	);
	addRow(
		s1,
		inputs,
		"sleepStartH",
		"Sleep starts",
		cfg.sleepStartH,
		0,
		23,
		"h (0–23)",
		"Hour when the bonus window ends and sleep begins. Pace expectations freeze during sleep — you're not expected to use tokens overnight.",
	);

	const s2 = addSection(panel, "Neutral tolerance");
	addRow(
		s2,
		inputs,
		"bandWeekly",
		"Weekly buckets",
		cfg.bandWeekly,
		0,
		20,
		"%pp ±",
		"How many percentage points off from the expected weekly pace before the badge turns red or green. Wider = more forgiving.",
	);
	addRow(
		s2,
		inputs,
		"bandSession",
		"Session (5h)",
		cfg.bandSession,
		0,
		20,
		"%pp ±",
		"Same tolerance for the 5-hour session bucket, which resets more often and naturally varies more than the weekly view.",
	);

	const s3 = addSection(panel, "Polling");
	addRow(
		s3,
		inputs,
		"pollIntervalMin",
		"Check interval",
		cfg.pollIntervalMin,
		1,
		120,
		"min",
		"How often the script re-fetches usage data from Claude's API in the background. Lower = more up to date, higher = fewer requests.",
	);

	renderMcpSection(panel, () => cfg, applySettings);

	// Separator + footer
	panel.appendChild(el("div", S.sep));
	const footer = el("div", S.footer);
	const resetBtn = mkBtn("Reset defaults", false, true);
	const cancelBtn = mkBtn("Cancel");
	const saveBtn = mkBtn("Save", true);

	function close() {
		overlay.remove();
		document.removeEventListener("keydown", onKey);
	}
	function onKey(e) {
		if (e.key === "Escape") close();
	}
	document.addEventListener("keydown", onKey);
	hdrClose.onclick = close;
	cancelBtn.onclick = close;
	overlay.addEventListener("click", (e) => {
		if (e.target === overlay) close();
	});

	resetBtn.onclick = () => {
		for (const [k, inp] of Object.entries(inputs)) inp.value = CFG_DEFAULTS[k];
	};
	saveBtn.onclick = () => {
		const newCfg = { ...cfg };
		for (const [k, inp] of Object.entries(inputs)) {
			const def = CFG_DEFAULTS[k];
			newCfg[k] = Math.min(
				Math.max(parseInt(inp.value, 10) || def, +inp.min),
				+inp.max,
			);
		}
		applySettings(newCfg);
		close();
	};

	footer.appendChild(resetBtn);
	footer.appendChild(cancelBtn);
	footer.appendChild(saveBtn);
	panel.appendChild(footer);
	overlay.appendChild(panel);
	document.body.appendChild(overlay);
}
