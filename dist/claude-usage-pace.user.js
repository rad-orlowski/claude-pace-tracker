// ==UserScript==
// @name         Claude.ai Usage Pace Indicator
// @namespace    https://github.com/rad-orlowski/claude-pace-tracker
// @version      3.5.0
// @description  Adds a pace marker and over/under pace badge to each bucket on the usage page at claude.ai/settings/usage
// @author       Rad Orlowski (https://github.com/rad-orlowski)
// @homepageURL  https://github.com/rad-orlowski/claude-pace-tracker
// @supportURL   https://github.com/rad-orlowski/claude-pace-tracker/issues
// @updateURL    https://github.com/rad-orlowski/claude-pace-tracker/raw/main/dist/claude-usage-pace.user.js
// @downloadURL  https://github.com/rad-orlowski/claude-pace-tracker/raw/main/dist/claude-usage-pace.user.js
// @license      GPL-3.0-or-later
// @match        https://claude.ai/settings/usage*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(() => {
  // src/capture.js
  var LOG = (...args) => console.log("[claude-pace]", ...args);
  var WARN = (...args) => console.warn("[claude-pace]", ...args);
  var USAGE_RE = /\/api\/organizations\/([0-9a-f-]+)\/usage(\?|$)/;
  var capturedOrgId = null;
  function getCapturedOrgId() {
    return capturedOrgId;
  }
  function getOrgIdFromCookie() {
    const m = document.cookie.match(/(?:^|;\s*)lastActiveOrg=([0-9a-f-]+)/);
    return m ? m[1] : null;
  }
  function installCapture(onUsage, onFirstCapture) {
    if (window.__claudeUsagePaceFetchPatched) {
      LOG("fetch already patched — skipping");
      return;
    }
    window.__claudeUsagePaceFetchPatched = true;
    LOG("patching window.fetch");
    const orig = window.fetch;
    window.fetch = function(input, init) {
      const p = orig.apply(this, arguments);
      let url = "";
      try {
        url = typeof input === "string" ? input : input && input.url || "";
      } catch (_) {}
      const m = url && USAGE_RE.exec(url);
      if (m) {
        if (!capturedOrgId) {
          capturedOrgId = m[1];
          LOG("captured orgId from fetch:", capturedOrgId);
          onFirstCapture?.();
        }
        LOG("observed /usage fetch", { url });
        p.then((r) => {
          if (!r || !r.ok) {
            WARN("fetch response not OK", r && r.status);
            return;
          }
          return r.clone().json().then((d) => onUsage(d));
        }).catch((e) => {
          WARN("failed to read /usage response:", e);
        });
      }
      return p;
    };
  }

  // src/polling.js
  var LOG2 = (...args) => console.log("[claude-pace]", ...args);
  var WARN2 = (...args) => console.warn("[claude-pace]", ...args);
  var pollTimer = null;
  var lastJson = null;
  function isPolling() {
    return pollTimer !== null;
  }
  function getLastJson() {
    return lastJson;
  }
  function setLastJson(json) {
    lastJson = json;
  }
  function startPolling(cfg) {
    if (pollTimer)
      return;
    const orgId = getCapturedOrgId() || getOrgIdFromCookie();
    if (!orgId) {
      LOG2("cannot start polling — orgId not yet known");
      return;
    }
    LOG2("starting /usage poll every", cfg.pollIntervalMin, "min for org", orgId);
    pollTimer = setInterval(_pollUsage, cfg.pollIntervalMin * 60000);
    if (!lastJson)
      _pollUsage();
  }
  function stopPolling() {
    if (!pollTimer)
      return;
    LOG2("stopping /usage poll");
    clearInterval(pollTimer);
    pollTimer = null;
  }
  function _pollUsage() {
    const orgId = getCapturedOrgId();
    if (!orgId)
      return;
    LOG2("polling /usage");
    window.fetch(`/api/organizations/${orgId}/usage`, {
      headers: { "content-type": "application/json", "anthropic-client-platform": "web_claude_ai" },
      credentials: "include"
    }).catch((e) => {
      WARN2("poll fetch threw:", e);
    });
  }

  // src/constants.js
  var BUCKET_MAP = {
    five_hour: { title: "Current session", periodMs: 5 * 60 * 60 * 1000 },
    seven_day: { title: "All models", periodMs: 7 * 24 * 60 * 60 * 1000 },
    seven_day_sonnet: { title: "Sonnet only", periodMs: 7 * 24 * 60 * 60 * 1000 },
    seven_day_opus: { title: "Opus only", periodMs: 7 * 24 * 60 * 60 * 1000 }
  };
  var PERIOD_LEN_MS = Object.fromEntries(Object.entries(BUCKET_MAP).map(([k, v]) => [k, v.periodMs]));
  var TITLE_TO_KEY = Object.fromEntries(Object.entries(BUCKET_MAP).map(([k, v]) => [v.title, k]));
  var NEUTRAL_BAND_PP = 5;
  var ACTIVE_START_H = 7;
  var ACTIVE_END_H = 20;
  var SLEEP_START_H = 23;

  // src/config.js
  var CFG_KEY = "__claude_pace_cfg";
  var CFG_DEFAULTS = {
    activeStartH: ACTIVE_START_H,
    activeEndH: ACTIVE_END_H,
    sleepStartH: SLEEP_START_H,
    bandWeekly: 2,
    bandSession: 5,
    pollIntervalMin: 10
  };
  function loadCfg() {
    try {
      const raw = localStorage.getItem(CFG_KEY);
      if (!raw)
        return { ...CFG_DEFAULTS };
      return { ...CFG_DEFAULTS, ...JSON.parse(raw) };
    } catch (_) {
      return { ...CFG_DEFAULTS };
    }
  }
  function saveCfg(c) {
    try {
      localStorage.setItem(CFG_KEY, JSON.stringify(c));
    } catch (_) {}
  }
  var _cfg = null;
  function getCfg() {
    if (!_cfg)
      _cfg = loadCfg();
    return _cfg;
  }
  function setCfg(c) {
    _cfg = c;
  }

  // src/math.js
  function timeWindowOf(date, activeStartH = ACTIVE_START_H, activeEndH = ACTIVE_END_H, sleepStartH = SLEEP_START_H) {
    const h = date.getHours() + date.getMinutes() / 60;
    if (h >= activeStartH && h < activeEndH)
      return "active";
    if (h >= activeEndH && h < sleepStartH)
      return "bonus";
    return "sleep";
  }
  function activeHoursBetween(startMs, endMs, activeStartH = ACTIVE_START_H, activeEndH = ACTIVE_END_H) {
    if (endMs <= startMs)
      return 0;
    let total = 0;
    const d = new Date(startMs);
    d.setHours(0, 0, 0, 0);
    while (d.getTime() < endMs) {
      const lo = Math.max(d.getTime() + activeStartH * 3600000, startMs);
      const hi = Math.min(d.getTime() + activeEndH * 3600000, endMs);
      if (hi > lo)
        total += hi - lo;
      d.setDate(d.getDate() + 1);
    }
    return total;
  }
  function activeElapsedPctOf(nowMs, resetsAt, periodMs, activeStartH = ACTIVE_START_H, activeEndH = ACTIVE_END_H) {
    const periodStart = resetsAt - periodMs;
    if (nowMs <= periodStart)
      return 0;
    const clampedNow = Math.min(nowMs, resetsAt);
    const totalActive = activeHoursBetween(periodStart, resetsAt, activeStartH, activeEndH);
    if (totalActive <= 0)
      return 0;
    const elapsed = activeHoursBetween(periodStart, clampedNow, activeStartH, activeEndH);
    return elapsed / totalActive * 100;
  }
  function frozenExpectedPctOf(nowMs, resetsAt, periodMs, activeStartH = ACTIVE_START_H, activeEndH = ACTIVE_END_H) {
    const eod = new Date(nowMs);
    eod.setHours(activeEndH, 0, 0, 0);
    if (eod.getTime() > nowMs)
      eod.setDate(eod.getDate() - 1);
    return activeElapsedPctOf(eod.getTime(), resetsAt, periodMs, activeStartH, activeEndH);
  }
  function todayEndExpectedPctOf(nowMs, resetsAtMs, periodMs, activeEndH = ACTIVE_END_H) {
    const eod = new Date(nowMs);
    eod.setHours(activeEndH, 0, 0, 0);
    const targetMs = Math.min(eod.getTime(), resetsAtMs);
    return activeElapsedPctOf(targetMs, resetsAtMs, periodMs);
  }
  function elapsedPctOf(now, resetsAt, periodMs) {
    const periodStart = resetsAt - periodMs;
    const elapsedMs = now - periodStart;
    if (elapsedMs <= 0)
      return 0;
    if (elapsedMs >= periodMs)
      return 100;
    return elapsedMs / periodMs * 100;
  }
  function deltaPpOf(usedPct, elapsedPct) {
    return usedPct - elapsedPct;
  }
  function severityOf(deltaPp, neutralBand = NEUTRAL_BAND_PP) {
    if (deltaPp > neutralBand)
      return "over";
    if (deltaPp < -neutralBand)
      return "under";
    return "neutral";
  }
  function signedPp(dp) {
    const n = Math.round(dp);
    return (n > 0 ? "+" : "") + n + "%";
  }

  // src/signals.js
  var SITUATION_MESSAGES = {
    CRITICAL_LIMIT: (p) => `${p.model} weekly limit at ${p.pct}% — nearly exhausted. Minimise token use.`,
    RESET_TIGHT: (p) => `Reset in ${p.resetInH}h with ${p.pct}% used. Tight — wrap up heavy tasks or wait for the reset.`,
    RESET_OPPORTUNITY: (p) => `Reset in ${p.resetInH}h — ${p.pctLeft}% of quota unused. Good time to front-load heavy Sonnet work.`,
    SLEEP: (p) => `Resting. End-of-day: all-models ${p.allWDp}, Sonnet ${p.sonWDp}.`,
    BONUS_CATCH_UP: (p) => `Past active hours but ${p.dayDp}% short of today's target. Bonus window — close the gap if you can.`,
    BONUS_OK: (p) => `Daily target hit. Weekly at ${p.allWDp} — you're on track. Keep coding if you have work, or stop for the day.`,
    BOTH_WEEKLY_OVER: (p) => `Both weekly limits running hot — all-models +${p.allWDp}%, Sonnet +${p.sonWDp}%. Ease off to preserve quota.`,
    WEEKLY_OVER_CORRECTING: (p) => `Weekly ${p.model} is +${p.wDp}% ahead but today is light — naturally self-correcting. Keep this daily pace.`,
    ALL_OVER_SONNET_UNDER: (p) => `Overall usage is high (+${p.allWDp}%) but Sonnet is underused. Prefer Sonnet for remaining work to get more value from it.`,
    ALL_OVER: (p) => `All-models weekly is +${p.allWDp}% ahead. Sonnet quota is fine — shift to Sonnet-heavy tasks to slow the overall burn.`,
    SONNET_OVER: (p) => p.opusAhead ? `Sonnet weekly is +${p.sonWDp}% ahead. Opus is also running hot — switch to Haiku for lightweight tasks.` : `Sonnet weekly is +${p.sonWDp}% ahead. Switch to Opus or Haiku to preserve Sonnet quota.`,
    SESSION_HOT_WEEKLY_SLACK: (p) => `Hot session (+${p.sessDp}%) but weekly is conserved (${p.allWDp}% under). Budget available — keep the pace.`,
    SESSION_HOT_DAILY_SLOW: (p) => `This session is hot (+${p.sessDp}%) but today's overall is still under target — slow start, active now. No concern yet.`,
    SESSION_HOT: (p) => `Session is running hot (+${p.sessDp}%). Weekly budget is healthy — but watch if this pace continues.`,
    WEEKLY_UNDER_RECOVERING: (p) => `Behind on the week (${p.wDp}% under) but today is accelerating. Sustain this daily pace for ${p.daysLeft}d to catch up.`,
    BOTH_WEEKLY_UNDER: (p) => `Weekly usage is light — all-models ${p.allWDp}% under, Sonnet ${p.sonWDp}% under. Good time for heavy tasks.`,
    DAILY_BEHIND: (p) => `Behind today's target by ${p.dayDp}%. Push before ${p.activeEndH}:00 to stay on the weekly curve.`,
    DAILY_OK_WEEKLY_LAGGING: (p) => `Today looks fine but the week is light (${p.allWDp}% under). Sustain this daily pace to stay on track.`,
    SONNET_LIGHT: (p) => `Sonnet weekly is light (${p.sonWDp}% under). Prefer Sonnet for quality-critical tasks — you have the headroom.`,
    ALL_CLEAR: () => `All pace indicators on track. Keep going.`
  };
  function buildSignals(json, now, cfg) {
    const allB = json && json.seven_day;
    const sonB = json && json.seven_day_sonnet;
    const sessB = json && json.five_hour;
    if (!allB || allB.utilization == null || !allB.resets_at)
      return null;
    if (!sonB || sonB.utilization == null || !sonB.resets_at)
      return null;
    if (!sessB || sessB.utilization == null || !sessB.resets_at)
      return null;
    const wMs = 7 * 24 * 60 * 60 * 1000;
    const sMs = 5 * 60 * 60 * 1000;
    const allRA = Date.parse(allB.resets_at);
    const sonRA = Date.parse(sonB.resets_at);
    const sessRA = Date.parse(sessB.resets_at);
    if (!Number.isFinite(allRA) || !Number.isFinite(sonRA) || !Number.isFinite(sessRA))
      return null;
    const bW = cfg.bandWeekly;
    const bS = cfg.bandSession;
    const allWElapsed = activeElapsedPctOf(now, allRA, wMs, cfg.activeStartH, cfg.activeEndH);
    const sonWElapsed = activeElapsedPctOf(now, sonRA, wMs, cfg.activeStartH, cfg.activeEndH);
    const sessElapsed = activeElapsedPctOf(now, sessRA, sMs, cfg.activeStartH, cfg.activeEndH);
    const allWDp = deltaPpOf(allB.utilization, allWElapsed);
    const sonWDp = deltaPpOf(sonB.utilization, sonWElapsed);
    const sessDp = deltaPpOf(sessB.utilization, sessElapsed);
    const allTodayExp = todayEndExpectedPctOf(now, allRA, wMs, cfg.activeEndH);
    const sonTodayExp = todayEndExpectedPctOf(now, sonRA, wMs, cfg.activeEndH);
    const allDDp = deltaPpOf(allB.utilization, allTodayExp);
    const sonDDp = deltaPpOf(sonB.utilization, sonTodayExp);
    const resetInMs = Math.min(allRA, sonRA) - now;
    const resetInH = Math.max(0, resetInMs / 3600000);
    const daysLeft = Math.ceil(resetInMs / (24 * 3600000));
    const win = timeWindowOf(new Date(now), cfg.activeStartH, cfg.activeEndH, cfg.sleepStartH);
    const opusB = json && json.seven_day_opus;
    const opusPct = opusB && opusB.utilization != null ? opusB.utilization : null;
    return {
      session: { dp: sessDp, sev: severityOf(sessDp, bS) },
      allWeekly: { dp: allWDp, sev: severityOf(allWDp, bW), pct: allB.utilization },
      allDaily: { dp: allDDp, sev: severityOf(allDDp, bW) },
      sonnetWeekly: { dp: sonWDp, sev: severityOf(sonWDp, bW), pct: sonB.utilization },
      sonnetDaily: { dp: sonDDp, sev: severityOf(sonDDp, bW) },
      window: win,
      resetInH,
      daysLeft,
      opusPct
    };
  }
  function classifySituation(signals, cfg) {
    const { session, allWeekly, allDaily, sonnetWeekly, sonnetDaily, window: win, resetInH, daysLeft, opusPct } = signals;
    if (allWeekly.pct > 90)
      return { key: "CRITICAL_LIMIT", params: { model: "All-models", pct: Math.round(allWeekly.pct) } };
    if (sonnetWeekly.pct > 90)
      return { key: "CRITICAL_LIMIT", params: { model: "Sonnet", pct: Math.round(sonnetWeekly.pct) } };
    if (resetInH < 4 && (allWeekly.pct > 75 || sonnetWeekly.pct > 75))
      return { key: "RESET_TIGHT", params: {
        resetInH: resetInH.toFixed(1),
        pct: Math.round(Math.max(allWeekly.pct, sonnetWeekly.pct))
      } };
    if (resetInH < 4 && allWeekly.pct < 40 && sonnetWeekly.pct < 40)
      return { key: "RESET_OPPORTUNITY", params: {
        resetInH: resetInH.toFixed(1),
        pctLeft: Math.round(100 - allWeekly.pct)
      } };
    if (win === "sleep")
      return { key: "SLEEP", params: {
        allWDp: signedPp(allWeekly.dp),
        sonWDp: signedPp(sonnetWeekly.dp)
      } };
    if (win === "bonus" && (allDaily.sev === "under" || sonnetDaily.sev === "under")) {
      const dayDp = Math.round(Math.abs(Math.min(allDaily.dp, sonnetDaily.dp)));
      return { key: "BONUS_CATCH_UP", params: { dayDp } };
    }
    if (win === "bonus") {
      if (allWeekly.sev === "over" && sonnetWeekly.sev === "over")
        return { key: "BOTH_WEEKLY_OVER", params: { allWDp: Math.round(allWeekly.dp), sonWDp: Math.round(sonnetWeekly.dp) } };
      if (allWeekly.sev === "over" && sonnetWeekly.sev === "under")
        return { key: "ALL_OVER_SONNET_UNDER", params: { allWDp: Math.round(allWeekly.dp) } };
      if (allWeekly.sev === "over")
        return { key: "ALL_OVER", params: { allWDp: Math.round(allWeekly.dp) } };
      if (sonnetWeekly.sev === "over")
        return { key: "SONNET_OVER", params: { sonWDp: Math.round(sonnetWeekly.dp), opusAhead: opusPct != null && opusPct > sonnetWeekly.pct } };
      return { key: "BONUS_OK", params: { allWDp: signedPp(allWeekly.dp) } };
    }
    if (allWeekly.sev === "over" && sonnetWeekly.sev === "over")
      return { key: "BOTH_WEEKLY_OVER", params: {
        allWDp: Math.round(allWeekly.dp),
        sonWDp: Math.round(sonnetWeekly.dp)
      } };
    if (allWeekly.sev === "over" && allDaily.sev === "under")
      return { key: "WEEKLY_OVER_CORRECTING", params: { model: "all-models", wDp: Math.round(allWeekly.dp) } };
    if (sonnetWeekly.sev === "over" && sonnetDaily.sev === "under")
      return { key: "WEEKLY_OVER_CORRECTING", params: { model: "Sonnet", wDp: Math.round(sonnetWeekly.dp) } };
    if (allWeekly.sev === "over" && sonnetWeekly.sev === "under")
      return { key: "ALL_OVER_SONNET_UNDER", params: { allWDp: Math.round(allWeekly.dp) } };
    if (allWeekly.sev === "over")
      return { key: "ALL_OVER", params: { allWDp: Math.round(allWeekly.dp) } };
    if (sonnetWeekly.sev === "over")
      return { key: "SONNET_OVER", params: { sonWDp: Math.round(sonnetWeekly.dp), opusAhead: opusPct != null && opusPct > sonnetWeekly.pct } };
    if (session.sev === "over" && allWeekly.sev === "under" && sonnetWeekly.sev === "under")
      return { key: "SESSION_HOT_WEEKLY_SLACK", params: {
        sessDp: Math.round(session.dp),
        allWDp: Math.round(Math.abs(allWeekly.dp))
      } };
    if (session.sev === "over" && (allDaily.sev === "under" || sonnetDaily.sev === "under"))
      return { key: "SESSION_HOT_DAILY_SLOW", params: { sessDp: Math.round(session.dp) } };
    if (session.dp > cfg.bandSession * 2)
      return { key: "SESSION_HOT", params: { sessDp: Math.round(session.dp) } };
    if (allWeekly.sev === "under" && allDaily.sev === "over")
      return { key: "WEEKLY_UNDER_RECOVERING", params: {
        model: "all-models",
        wDp: Math.round(Math.abs(allWeekly.dp)),
        daysLeft
      } };
    if (sonnetWeekly.sev === "under" && sonnetDaily.sev === "over")
      return { key: "WEEKLY_UNDER_RECOVERING", params: {
        model: "Sonnet",
        wDp: Math.round(Math.abs(sonnetWeekly.dp)),
        daysLeft
      } };
    if (allWeekly.sev === "under" && sonnetWeekly.sev === "under")
      return { key: "BOTH_WEEKLY_UNDER", params: {
        allWDp: Math.round(Math.abs(allWeekly.dp)),
        sonWDp: Math.round(Math.abs(sonnetWeekly.dp))
      } };
    if (allDaily.sev === "under" || sonnetDaily.sev === "under") {
      const dayDp = Math.round(Math.abs(Math.min(allDaily.dp, sonnetDaily.dp)));
      return { key: "DAILY_BEHIND", params: { dayDp, activeEndH: cfg.activeEndH } };
    }
    if (allWeekly.sev === "under")
      return { key: "DAILY_OK_WEEKLY_LAGGING", params: { allWDp: Math.round(Math.abs(allWeekly.dp)) } };
    if (sonnetWeekly.sev === "under")
      return { key: "SONNET_LIGHT", params: { sonWDp: Math.round(Math.abs(sonnetWeekly.dp)) } };
    return { key: "ALL_CLEAR", params: {} };
  }

  // src/ui/components/bar.js
  var BAR_COLORS = {
    active: "#5c7dd6",
    activeAlt: "#4a6bbf",
    bonus: "#b8931e",
    sleep: "#454f65"
  };
  var MASK_CLASS = "__claude-pace-mask";
  function buildBarGradient(periodStartMs, periodMs, activeStartH = ACTIVE_START_H, activeEndH = ACTIVE_END_H, sleepStartH = SLEEP_START_H) {
    const stops = [];
    const periodEnd = periodStartMs + periodMs;
    const cursor = new Date(periodStartMs);
    cursor.setHours(0, 0, 0, 0);
    while (cursor.getTime() < periodEnd) {
      const day = cursor.getTime();
      const windows = [
        { start: day, end: day + activeStartH * 3600000, color: BAR_COLORS.sleep },
        { start: day + activeStartH * 3600000, end: day + activeEndH * 3600000, color: BAR_COLORS.active },
        { start: day + activeEndH * 3600000, end: day + sleepStartH * 3600000, color: BAR_COLORS.bonus },
        { start: day + sleepStartH * 3600000, end: day + 24 * 3600000, color: BAR_COLORS.sleep }
      ];
      for (const w of windows) {
        const lo = Math.max(w.start, periodStartMs);
        const hi = Math.min(w.end, periodEnd);
        if (hi <= lo)
          continue;
        const pLo = ((lo - periodStartMs) / periodMs * 100).toFixed(3);
        const pHi = ((hi - periodStartMs) / periodMs * 100).toFixed(3);
        stops.push(`${w.color} ${pLo}%`);
        stops.push(`${w.color} ${pHi}%`);
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    let result = `linear-gradient(to right,${stops.join(",")})`;
    result = result.replace(/100\.000%\)/, "100%)");
    return result;
  }
  function buildWeeklyBar(days = 7) {
    const segW = 100 / days;
    const colors = [BAR_COLORS.active, BAR_COLORS.activeAlt];
    const stops = [];
    for (let i = 0;i < days; i++) {
      const lo = (i * segW).toFixed(3);
      const hi = ((i + 1) * segW).toFixed(3);
      stops.push(`${colors[i % 2]} ${lo}%`, `${colors[i % 2]} ${hi}%`);
    }
    return `linear-gradient(to right,${stops.join(",")})`.replace("100.000%)", "100%)");
  }
  function applyBarGradient(bar, periodStartMs, periodMs, usedPct, bucketKey) {
    bar.style.background = bucketKey === "five_hour" ? buildBarGradient(periodStartMs, periodMs) : buildWeeklyBar();
    bar.style.border = "none";
    const fill = bar.querySelector("div");
    if (fill)
      fill.style.background = "transparent";
    if (getComputedStyle(bar).position === "static")
      bar.style.position = "relative";
    let mask = bar.querySelector("." + MASK_CLASS);
    if (!mask) {
      mask = document.createElement("div");
      mask.className = MASK_CLASS;
      Object.assign(mask.style, {
        position: "absolute",
        top: "0",
        bottom: "0",
        right: "0",
        background: "rgba(0,0,0,0.62)",
        pointerEvents: "none",
        zIndex: "1"
      });
      bar.appendChild(mask);
    }
    mask.style.left = usedPct.toFixed(2) + "%";
    mask.style.borderRadius = usedPct <= 1 ? "4px" : "0 4px 4px 0";
  }

  // src/ui/lucide.js
  var lucideReady = false;
  var lucideLoadPromise = null;
  function isLucideReady() {
    return lucideReady;
  }
  function ensureLucide() {
    if (window.lucide) {
      lucideReady = true;
      return Promise.resolve();
    }
    if (lucideLoadPromise)
      return lucideLoadPromise;
    lucideLoadPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://unpkg.com/lucide@latest/dist/umd/lucide.min.js";
      s.onload = () => {
        lucideReady = true;
        resolve();
      };
      s.onerror = () => reject(new Error("[claude-pace] Lucide CDN load failed"));
      document.head.appendChild(s);
    });
    return lucideLoadPromise;
  }
  function makeLucideIcon(name, size = 12) {
    const el = document.createElement("i");
    el.dataset.lucide = name;
    Object.assign(el.style, {
      width: size + "px",
      height: size + "px",
      display: "inline-flex",
      alignItems: "center",
      flexShrink: "0"
    });
    return el;
  }
  function renderLucideIcons(container) {
    if (!window.lucide)
      return;
    try {
      window.lucide.createIcons({ nodes: [container] });
    } catch (_) {
      window.lucide.createIcons();
    }
  }

  // src/ui/components/now-marker.js
  var MARKER_CLASS = "__claude-pace-marker";
  function ensureMarker(host) {
    if (getComputedStyle(host).position === "static")
      host.style.position = "relative";
    let marker = host.querySelector("." + MARKER_CLASS);
    if (!marker) {
      let populateMarkerCap = function() {
        cap.innerHTML = "";
        if (isLucideReady()) {
          cap.appendChild(makeLucideIcon("clock", 10));
          renderLucideIcons(cap);
        } else {
          cap.textContent = "⏱";
          ensureLucide().then(populateMarkerCap).catch(() => {});
        }
      };
      marker = document.createElement("div");
      marker.className = MARKER_CLASS;
      Object.assign(marker.style, {
        position: "absolute",
        top: "-3px",
        bottom: "-3px",
        width: "2px",
        background: "#f5c542",
        boxShadow: "0 0 4px #f5c542",
        pointerEvents: "none",
        transform: "translateX(-1px)",
        zIndex: "2"
      });
      const cap = document.createElement("span");
      Object.assign(cap.style, {
        position: "absolute",
        bottom: "calc(100% + 2px)",
        left: "0%",
        transform: "translateX(-50%)",
        fontSize: "10px",
        lineHeight: "1",
        color: "#f5c542",
        whiteSpace: "nowrap",
        fontFamily: "inherit",
        pointerEvents: "none",
        display: "inline-flex",
        alignItems: "center",
        gap: "2px"
      });
      populateMarkerCap();
      marker.appendChild(cap);
      const line = document.createElement("div");
      Object.assign(line.style, {
        position: "absolute",
        top: "0",
        bottom: "0",
        left: "50%",
        width: "2px",
        background: "#f5c542",
        transform: "translateX(-1px)",
        pointerEvents: "none",
        zIndex: "1"
      });
      marker.appendChild(line);
      host.appendChild(marker);
    }
    return marker;
  }

  // src/ui/components/day-dividers.js
  var DAY_DIV_CLASS = "__claude-pace-day-div";
  function ensureDayDividers(host, days) {
    host.querySelectorAll("." + DAY_DIV_CLASS).forEach((n) => n.remove());
    for (let i = 1;i < days; i++) {
      const div = document.createElement("div");
      div.className = DAY_DIV_CLASS;
      Object.assign(div.style, {
        position: "absolute",
        top: "-3px",
        bottom: "-3px",
        left: (i / days * 100).toFixed(3) + "%",
        width: "1px",
        transform: "translateX(-0.5px)",
        background: "rgba(255,255,255,0.18)",
        pointerEvents: "none",
        zIndex: "1"
      });
      host.appendChild(div);
    }
  }

  // src/ui/components/pill.js
  var PILL_CLASS = "__claude-pace-pill";
  var SUPPRESS_PILL_BEFORE_MS = 5 * 60 * 1000;
  var PILL_OVER = { color: "#ff7a7a", background: "rgba(255,90,90,0.15)", border: "1px solid rgba(255,90,90,0.35)" };
  var PILL_UNDER = { color: "#5dd28a", background: "rgba(80,200,120,0.15)", border: "1px solid rgba(80,200,120,0.35)" };
  var PILL_NEUTRAL = { color: "#aaa", background: "rgba(170,170,170,0.12)", border: "1px solid rgba(170,170,170,0.3)" };
  function dirIconName(dp, band) {
    if (dp > band)
      return "trending-up";
    if (dp < -band)
      return "trending-down";
    return "check";
  }
  function sevStyle(sev) {
    if (sev === "over")
      return { color: "#ff7a7a", bg: "rgba(255,90,90,0.15)", borderC: "rgba(255,90,90,0.35)" };
    if (sev === "under")
      return { color: "#5dd28a", bg: "rgba(80,200,120,0.15)", borderC: "rgba(80,200,120,0.35)" };
    return { color: "#aaa", bg: "rgba(170,170,170,0.12)", borderC: "rgba(170,170,170,0.3)" };
  }
  function ensurePill(usedLabel) {
    let pill = usedLabel.querySelector("." + PILL_CLASS);
    if (!pill) {
      pill = document.createElement("span");
      pill.className = PILL_CLASS;
      Object.assign(pill.style, {
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        marginTop: "4px",
        padding: "2px 8px",
        borderRadius: "999px",
        fontSize: "11px",
        fontWeight: "600",
        whiteSpace: "nowrap",
        lineHeight: "1.4"
      });
      usedLabel.appendChild(document.createElement("br"));
      usedLabel.appendChild(pill);
    }
    return pill;
  }

  // src/ui/components/summary-card.js
  var SUMMARY_CLASS = "__claude-pace-summary";
  var SUMMARY_CATEGORY_INFO = {
    CRITICAL_LIMIT: { colour: "#ff7a7a", icon: "alert-triangle", fallback: "⚠" },
    RESET_TIGHT: { colour: "#ff7a7a", icon: "alert-triangle", fallback: "⚠" },
    RESET_OPPORTUNITY: { colour: "#5dd28a", icon: "gift", fallback: "\uD83C\uDF81" },
    SLEEP: { colour: "#8899bb", icon: "moon", fallback: "\uD83C\uDF19" },
    BONUS_CATCH_UP: { colour: "#e8b84a", icon: "star", fallback: "⭐" },
    BONUS_OK: { colour: "#e8b84a", icon: "star", fallback: "⭐" },
    BOTH_WEEKLY_OVER: { colour: "#ff7a7a", icon: "trending-up", fallback: "↑" },
    WEEKLY_OVER_CORRECTING: { colour: "#f5c542", icon: "zap", fallback: "⚡" },
    ALL_OVER_SONNET_UNDER: { colour: "#f5c542", icon: "zap", fallback: "⚡" },
    ALL_OVER: { colour: "#ff7a7a", icon: "trending-up", fallback: "↑" },
    SONNET_OVER: { colour: "#ff7a7a", icon: "trending-up", fallback: "↑" },
    SESSION_HOT_WEEKLY_SLACK: { colour: "#5dd28a", icon: "check", fallback: "✓" },
    SESSION_HOT_DAILY_SLOW: { colour: "#f5c542", icon: "zap", fallback: "⚡" },
    SESSION_HOT: { colour: "#f5c542", icon: "trending-up", fallback: "↑" },
    WEEKLY_UNDER_RECOVERING: { colour: "#8aabff", icon: "trending-down", fallback: "↓" },
    BOTH_WEEKLY_UNDER: { colour: "#8aabff", icon: "trending-down", fallback: "↓" },
    DAILY_BEHIND: { colour: "#8aabff", icon: "trending-down", fallback: "↓" },
    DAILY_OK_WEEKLY_LAGGING: { colour: "#8aabff", icon: "trending-down", fallback: "↓" },
    SONNET_LIGHT: { colour: "#5dd28a", icon: "check", fallback: "✓" },
    ALL_CLEAR: { colour: "#5dd28a", icon: "check", fallback: "✓" }
  };
  function renderSummaryPanel(section, key, params) {
    const msgFn = SITUATION_MESSAGES[key];
    const info = SUMMARY_CATEGORY_INFO[key];
    if (!msgFn || !info)
      return;
    let wrapper = section.querySelector("." + SUMMARY_CLASS);
    if (!wrapper) {
      wrapper = document.createElement("div");
      wrapper.className = SUMMARY_CLASS;
      Object.assign(wrapper.style, { display: "flex", justifyContent: "flex-end" });
      const card2 = document.createElement("div");
      Object.assign(card2.style, {
        display: "flex",
        alignItems: "flex-start",
        gap: "12px",
        background: "rgba(255,255,255,0.03)",
        borderRadius: "8px",
        borderLeft: `3px solid ${info.colour}`,
        padding: "10px 14px",
        fontSize: "14px",
        lineHeight: "1.5",
        flex: "1",
        maxWidth: "36rem"
      });
      const iconEl2 = document.createElement("span");
      iconEl2.className = SUMMARY_CLASS + "-icon";
      Object.assign(iconEl2.style, { flexShrink: "0", marginTop: "1px" });
      const body = document.createElement("div");
      const label2 = document.createElement("div");
      label2.className = SUMMARY_CLASS + "-label";
      label2.textContent = "PACE";
      Object.assign(label2.style, {
        fontSize: "10px",
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        marginBottom: "3px",
        color: info.colour
      });
      const text = document.createElement("div");
      text.className = SUMMARY_CLASS + "-text";
      Object.assign(text.style, { color: "#c9d1d9" });
      body.appendChild(label2);
      body.appendChild(text);
      card2.appendChild(iconEl2);
      card2.appendChild(body);
      wrapper.appendChild(card2);
      const ref = section.children[1];
      if (ref)
        section.insertBefore(wrapper, ref);
      else
        section.appendChild(wrapper);
    }
    const card = wrapper.firstElementChild;
    card.style.borderLeftColor = info.colour;
    const label = card.querySelector("." + SUMMARY_CLASS + "-label");
    label.style.color = info.colour;
    const iconEl = card.querySelector("." + SUMMARY_CLASS + "-icon");
    iconEl.innerHTML = "";
    if (isLucideReady()) {
      iconEl.appendChild(makeLucideIcon(info.icon, 14));
      renderLucideIcons(iconEl);
    } else {
      iconEl.textContent = info.fallback;
      ensureLucide().then(() => {
        iconEl.innerHTML = "";
        iconEl.appendChild(makeLucideIcon(info.icon, 14));
        renderLucideIcons(iconEl);
      }).catch(() => {});
    }
    card.querySelector("." + SUMMARY_CLASS + "-text").textContent = msgFn(params);
  }

  // src/ui/dom.js
  var rowCache = new Map;
  var KNOWN_TITLES = new Set(Object.values(BUCKET_MAP).map((m) => m.title));
  function rebuildRowCache() {
    rowCache.clear();
    for (const bar of document.querySelectorAll('[role="progressbar"]')) {
      const barWrapper = bar.parentElement;
      const progressContainer = barWrapper && barWrapper.parentElement;
      const row = progressContainer && progressContainer.parentElement;
      if (!row)
        continue;
      let title = null;
      for (const span of row.querySelectorAll("span")) {
        const t = span.textContent.trim();
        if (KNOWN_TITLES.has(t)) {
          title = t;
          break;
        }
      }
      if (!title)
        continue;
      const usedLabel = progressContainer.querySelector("span.text-right");
      if (!usedLabel)
        continue;
      rowCache.set(title, { row, bar, barWrapper, usedLabel });
    }
  }
  function findUsageSection() {
    for (const h of document.querySelectorAll("h2, h3")) {
      if (h.textContent.includes("Plan usage limits")) {
        let el = h;
        while (el && el.tagName !== "SECTION")
          el = el.parentElement;
        return el && el.tagName === "SECTION" ? el : null;
      }
    }
    return null;
  }
  function findRowByTitle(title) {
    const cached = rowCache.get(title);
    if (cached && cached.row.isConnected)
      return cached;
    rebuildRowCache();
    return rowCache.get(title) || null;
  }

  // src/render.js
  var renderRetryTimer = null;
  var RENDER_RETRY_MS = 100;
  var RENDER_RETRY_MAX = 30;
  function appendStat(target, iconName, value) {
    if (isLucideReady()) {
      target.appendChild(makeLucideIcon(iconName, 12));
      renderLucideIcons(target);
    }
    target.appendChild(document.createTextNode(" " + Math.round(Math.abs(value)) + "%"));
  }
  function renderMarkerAndPill(bucketKey, util, resetsAt, cfg) {
    const meta = BUCKET_MAP[bucketKey];
    if (!meta)
      return false;
    const dom = findRowByTitle(meta.title);
    if (!dom)
      return false;
    const periodMs = meta.periodMs;
    const resetsAtMs = Date.parse(resetsAt);
    if (!Number.isFinite(resetsAtMs))
      return false;
    const now = Date.now();
    const periodStartMs = resetsAtMs - periodMs;
    applyBarGradient(dom.bar, periodStartMs, periodMs, util, bucketKey);
    const elapsedPct = bucketKey === "five_hour" ? elapsedPctOf(now, resetsAtMs, periodMs) : activeElapsedPctOf(now, resetsAtMs, periodMs, cfg.activeStartH, cfg.activeEndH);
    const win = timeWindowOf(new Date(now), cfg.activeStartH, cfg.activeEndH, cfg.sleepStartH);
    const band = bucketKey === "five_hour" ? cfg.bandSession : cfg.bandWeekly;
    const markerPct = bucketKey === "five_hour" ? elapsedPct : win === "active" ? elapsedPct : frozenExpectedPctOf(now, resetsAtMs, periodMs, cfg.activeStartH, cfg.activeEndH);
    const markerHost = dom.barWrapper || dom.bar;
    const marker = ensureMarker(markerHost);
    if (bucketKey !== "five_hour")
      ensureDayDividers(markerHost, 7);
    const mLeft = Math.max(0, markerPct - band);
    const mRight = Math.min(100, markerPct + band);
    marker.style.left = mLeft.toFixed(2) + "%";
    marker.style.width = (mRight - mLeft).toFixed(2) + "%";
    marker.style.background = "rgba(245,197,66,0.18)";
    marker.style.boxShadow = "none";
    const lineEl = marker.querySelector("div");
    const capEl = marker.querySelector("span");
    if (mRight > mLeft) {
      const nowPct = ((markerPct - mLeft) / (mRight - mLeft) * 100).toFixed(2) + "%";
      if (lineEl)
        lineEl.style.left = nowPct;
      if (capEl)
        capEl.style.left = nowPct;
    }
    const pill = ensurePill(dom.usedLabel);
    const elapsedMs = now - periodStartMs;
    if (elapsedMs < SUPPRESS_PILL_BEFORE_MS) {
      pill.style.display = "none";
      return true;
    }
    pill.style.display = "inline-flex";
    pill.innerHTML = "";
    Object.assign(pill.style, { padding: "2px 8px", gap: "4px", overflow: "" });
    let styles = null;
    if (bucketKey === "five_hour") {
      const dp = deltaPpOf(util, elapsedPct);
      const sev = severityOf(dp, band);
      pill.title = "Session pace vs time elapsed";
      styles = sev === "over" ? PILL_OVER : sev === "under" ? PILL_UNDER : PILL_NEUTRAL;
      appendStat(pill, dirIconName(dp, band), dp);
    } else if (win === "sleep") {
      const weekDp = deltaPpOf(util, markerPct);
      pill.title = "Weekly pace vs end-of-active-day target";
      styles = { color: "#8899bb", background: "rgba(136,153,187,0.1)", border: "1px solid rgba(136,153,187,0.25)" };
      appendStat(pill, "moon", weekDp);
    } else if (win === "bonus") {
      const frozen = markerPct;
      if (util < frozen) {
        pill.title = `Below today's target — ${Math.round(frozen - util)}% to go`;
        styles = { color: "#e8b84a", background: "rgba(232,184,74,0.12)", border: "1px solid rgba(232,184,74,0.35)" };
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
      const todayExpected = todayEndExpectedPctOf(now, resetsAtMs, periodMs, cfg.activeEndH);
      const todayDp = deltaPpOf(util, todayExpected);
      const todaySev = severityOf(todayDp, band);
      const ws = sevStyle(weekSev);
      const ts = sevStyle(todaySev);
      Object.assign(pill.style, {
        padding: "0",
        gap: "0",
        overflow: "hidden",
        background: "none",
        border: ""
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
        borderRadius: "999px 0 0 999px"
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
        borderRadius: "0 999px 999px 0"
      });
      appendStat(rh, dirIconName(todayDp, band), todayDp);
      pill.appendChild(rh);
      if (isLucideReady())
        renderLucideIcons(pill);
    }
    if (styles)
      Object.assign(pill.style, styles);
    return true;
  }
  function renderAllMarkers(json, cfg, attempt = 0) {
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
      renderRetryTimer = setTimeout(() => renderAllMarkers(json, cfg, attempt + 1), RENDER_RETRY_MS);
    }
  }

  // src/ui/styles.js
  function injectPaceStyles() {
    if (document.getElementById("__claude-pace-styles"))
      return;
    const s = document.createElement("style");
    s.id = "__claude-pace-styles";
    s.textContent = ".__claude-pace-pill{transition:opacity .15s;cursor:default;user-select:none}" + ".__claude-pace-pill:hover{opacity:.8}" + ".__claude-pace-pill-half{transition:filter .12s;cursor:default}" + ".__claude-pace-pill-half:hover{filter:brightness(1.25)}";
    document.head.appendChild(s);
  }

  // src/ui/components/settings.js
  var GEAR_ID = "__claude-pace-gear";
  var PANEL_ID = "__claude-pace-panel";
  var _gearRetryTimer = null;
  function tryInjectGear(getCfg2, applySettings, attempt = 0) {
    if (_injectSettingsGear(getCfg2, applySettings) || attempt >= 50)
      return;
    clearTimeout(_gearRetryTimer);
    _gearRetryTimer = setTimeout(() => tryInjectGear(getCfg2, applySettings, attempt + 1), 100);
  }
  function _injectSettingsGear(getCfg2, applySettings) {
    if (document.getElementById(GEAR_ID))
      return true;
    let anchor = null;
    for (const h of document.querySelectorAll("h2, h3")) {
      if (h.textContent.includes("Plan usage limits")) {
        anchor = h.querySelector("span") || h;
        break;
      }
    }
    if (!anchor)
      return false;
    const btn = document.createElement("button");
    btn.id = GEAR_ID;
    btn.title = "Pace indicator settings";
    Object.assign(btn.style, {
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
      flexShrink: "0"
    });
    btn.onmouseenter = () => {
      btn.style.color = "rgba(200,200,200,0.9)";
    };
    btn.onmouseleave = () => {
      btn.style.color = "rgba(170,170,170,0.45)";
    };
    btn.onclick = (e) => {
      e.stopPropagation();
      openSettingsPanel(getCfg2(), applySettings);
    };
    if (isLucideReady()) {
      btn.appendChild(makeLucideIcon("settings", 14));
      renderLucideIcons(btn);
    } else {
      btn.textContent = "⚙";
      ensureLucide().then(() => {
        btn.textContent = "";
        btn.appendChild(makeLucideIcon("settings", 14));
        renderLucideIcons(btn);
      }).catch(() => {});
    }
    anchor.appendChild(btn);
    return true;
  }
  function openSettingsPanel(cfg, applySettings) {
    if (document.getElementById(PANEL_ID))
      return;
    const overlay = document.createElement("div");
    overlay.id = PANEL_ID;
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      zIndex: "99999",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(0,0,0,0.55)",
      backdropFilter: "blur(2px)"
    });
    const panel = document.createElement("div");
    Object.assign(panel.style, {
      background: "#1a1d24",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "12px",
      padding: "20px 24px",
      minWidth: "340px",
      boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
      fontFamily: "inherit",
      color: "#e5e7eb"
    });
    const hdr = document.createElement("div");
    Object.assign(hdr.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: "16px"
    });
    const hdrTitle = document.createElement("div");
    Object.assign(hdrTitle.style, { fontSize: "14px", fontWeight: "600", color: "#f9fafb" });
    hdrTitle.textContent = "Pace indicator settings";
    const hdrClose = document.createElement("button");
    Object.assign(hdrClose.style, {
      background: "none",
      border: "none",
      cursor: "pointer",
      color: "#6b7280",
      fontSize: "18px",
      lineHeight: "1",
      padding: "0 2px"
    });
    hdrClose.textContent = "×";
    hdr.appendChild(hdrTitle);
    hdr.appendChild(hdrClose);
    panel.appendChild(hdr);
    function addSection(label) {
      const sec = document.createElement("div");
      Object.assign(sec.style, { marginBottom: "14px" });
      const lbl = document.createElement("div");
      Object.assign(lbl.style, {
        fontSize: "10px",
        fontWeight: "700",
        color: "#6b7280",
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        marginBottom: "8px"
      });
      lbl.textContent = label;
      sec.appendChild(lbl);
      panel.appendChild(sec);
      return sec;
    }
    const inputs = {};
    function addRow(parent, key, label, value, min, max, unit, helpText) {
      const row = document.createElement("div");
      Object.assign(row.style, {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "8px",
        marginBottom: "6px"
      });
      const lblWrap = document.createElement("div");
      Object.assign(lblWrap.style, { display: "flex", alignItems: "center", gap: "5px" });
      const lbl = document.createElement("label");
      lbl.htmlFor = "__cpace_" + key;
      Object.assign(lbl.style, { fontSize: "13px", color: "#d1d5db", cursor: "default" });
      lbl.textContent = label;
      lblWrap.appendChild(lbl);
      if (helpText) {
        const icon = document.createElement("span");
        icon.textContent = "?";
        Object.assign(icon.style, {
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
          transition: "color .12s, border-color .12s, background .12s"
        });
        const tip = document.createElement("div");
        Object.assign(tip.style, {
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
          whiteSpace: "normal"
        });
        tip.textContent = helpText;
        icon.appendChild(tip);
        icon.onmouseenter = () => {
          tip.style.display = "block";
          icon.style.color = "#c9d1d9";
          icon.style.borderColor = "rgba(255,255,255,0.5)";
          icon.style.background = "rgba(255,255,255,0.08)";
        };
        icon.onmouseleave = () => {
          tip.style.display = "none";
          icon.style.color = "#6b7280";
          icon.style.borderColor = "rgba(255,255,255,0.18)";
          icon.style.background = "";
        };
        lblWrap.appendChild(icon);
      }
      const right = document.createElement("div");
      Object.assign(right.style, { display: "flex", alignItems: "center", gap: "5px" });
      const inp = document.createElement("input");
      inp.type = "number";
      inp.id = "__cpace_" + key;
      inp.value = value;
      inp.min = min;
      inp.max = max;
      Object.assign(inp.style, {
        width: "54px",
        padding: "3px 6px",
        borderRadius: "6px",
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.06)",
        color: "#f9fafb",
        fontSize: "13px",
        textAlign: "center"
      });
      const unitEl = document.createElement("span");
      Object.assign(unitEl.style, { fontSize: "12px", color: "#6b7280", minWidth: "36px" });
      unitEl.textContent = unit;
      right.appendChild(inp);
      right.appendChild(unitEl);
      row.appendChild(lblWrap);
      row.appendChild(right);
      parent.appendChild(row);
      inputs[key] = inp;
    }
    const s1 = addSection("Active window");
    addRow(s1, "activeStartH", "Start hour", cfg.activeStartH, 0, 23, "h (0–23)", "Hour when your coding day begins. Before this, no tokens are expected — the pace clock starts here each day.");
    addRow(s1, "activeEndH", "End / bonus starts", cfg.activeEndH, 0, 23, "h (0–23)", "Hour when the active window closes and the bonus window begins. The daily target badge shows whether you're on pace by this hour.");
    addRow(s1, "sleepStartH", "Sleep starts", cfg.sleepStartH, 0, 23, "h (0–23)", "Hour when the bonus window ends and sleep begins. Pace expectations freeze during sleep — you're not expected to use tokens overnight.");
    const s2 = addSection("Neutral tolerance");
    addRow(s2, "bandWeekly", "Weekly buckets", cfg.bandWeekly, 0, 20, "%pp ±", "How many percentage points off from the expected weekly pace before the badge turns red or green. Wider = more forgiving.");
    addRow(s2, "bandSession", "Session (5h)", cfg.bandSession, 0, 20, "%pp ±", "Same tolerance for the 5-hour session bucket, which resets more often and naturally varies more than the weekly view.");
    const s3 = addSection("Polling");
    addRow(s3, "pollIntervalMin", "Check interval", cfg.pollIntervalMin, 1, 120, "min", "How often the script re-fetches usage data from Claude's API in the background. Lower = more up to date, higher = fewer requests.");
    const sep = document.createElement("div");
    Object.assign(sep.style, { borderTop: "1px solid rgba(255,255,255,0.08)", margin: "16px 0 14px" });
    panel.appendChild(sep);
    const footer = document.createElement("div");
    Object.assign(footer.style, { display: "flex", gap: "8px", justifyContent: "flex-end" });
    function mkBtn(label, primary, danger) {
      const b = document.createElement("button");
      b.textContent = label;
      Object.assign(b.style, {
        padding: "5px 13px",
        borderRadius: "6px",
        fontSize: "12px",
        fontWeight: "600",
        cursor: "pointer",
        border: "none",
        transition: "opacity .12s",
        background: primary ? "#3b5bdb" : danger ? "rgba(255,90,90,0.15)" : "rgba(255,255,255,0.08)",
        color: primary ? "#fff" : danger ? "#ff7a7a" : "#9ca3af"
      });
      b.onmouseenter = () => {
        b.style.opacity = "0.75";
      };
      b.onmouseleave = () => {
        b.style.opacity = "1";
      };
      return b;
    }
    const resetBtn = mkBtn("Reset defaults", false, true);
    const cancelBtn = mkBtn("Cancel");
    const saveBtn = mkBtn("Save", true);
    function close() {
      overlay.remove();
      document.removeEventListener("keydown", onKey);
    }
    function onKey(e) {
      if (e.key === "Escape")
        close();
    }
    document.addEventListener("keydown", onKey);
    hdrClose.onclick = close;
    cancelBtn.onclick = close;
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay)
        close();
    });
    resetBtn.onclick = () => {
      for (const [k, inp] of Object.entries(inputs))
        inp.value = CFG_DEFAULTS[k];
    };
    saveBtn.onclick = () => {
      const newCfg = {};
      for (const [k, inp] of Object.entries(inputs)) {
        const def = CFG_DEFAULTS[k];
        newCfg[k] = Math.min(Math.max(parseInt(inp.value, 10) || def, +inp.min), +inp.max);
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

  // src/lifecycle.js
  var MASK_CLASS2 = "__claude-pace-mask";
  var LOG3 = (...args) => console.log("[claude-pace]", ...args);
  function installLifecycle(onRerender, onResumePolling, onStopPolling) {
    setInterval(onRerender, 30000);
    const wrapHistory = (key) => {
      const orig = history[key];
      history[key] = function() {
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
        LOG3("navigated away from /settings/usage — teardown");
        teardownAll();
        onStopPolling();
      } else {
        LOG3("navigated onto /settings/usage");
        onResumePolling();
        onRerender();
      }
    }
    function teardownAll() {
      const gear = document.getElementById(GEAR_ID);
      if (gear)
        gear.remove();
      document.querySelectorAll("." + MARKER_CLASS + ", ." + PILL_CLASS + ", ." + MASK_CLASS2 + ", ." + SUMMARY_CLASS + ", ." + DAY_DIV_CLASS).forEach((n) => n.remove());
      document.querySelectorAll('[role="progressbar"]').forEach((bar) => {
        bar.style.background = "";
        bar.style.border = "";
        bar.style.position = "";
        const fill = bar.querySelector("div");
        if (fill)
          fill.style.background = "";
      });
    }
  }

  // src/main.js
  var LOG4 = (...args) => console.log("[claude-pace]", ...args);
  var WARN3 = (...args) => console.warn("[claude-pace]", ...args);
  function onUsage(json) {
    if (!json || typeof json !== "object")
      return;
    setLastJson(json);
    renderAllMarkers(json, getCfg());
  }
  function applySettings(newCfg) {
    const pollChanged = newCfg.pollIntervalMin !== getCfg().pollIntervalMin;
    setCfg(newCfg);
    saveCfg(newCfg);
    if (pollChanged) {
      stopPolling();
      startPolling(getCfg());
    }
    rerenderMarkersFromLast();
  }
  function rerenderMarkersFromLast() {
    tryInjectGear(getCfg, applySettings);
    const last = getLastJson();
    if (last)
      renderAllMarkers(last, getCfg());
  }
  LOG4("script loaded, version 3.5.0");
  installCapture(onUsage, () => {
    if (!isPolling())
      startPolling(getCfg());
  });
  function init() {
    LOG4("init() — installing UI");
    injectPaceStyles();
    ensureLucide().catch((e) => WARN3("Lucide load failed:", e));
    installLifecycle(rerenderMarkersFromLast, () => startPolling(getCfg()), stopPolling);
    startPolling(getCfg());
    tryInjectGear(getCfg, applySettings);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
