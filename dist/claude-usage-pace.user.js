// ==UserScript==
// @name         Claude.ai Usage Pace Indicator
// @namespace    https://github.com/rad-orlowski/claude-pace-tracker
// @version      4.1.0
// @description  Adds a pace marker and over/under pace badge to each usage bucket in the claude.ai usage panel (the #settings/usage hash route / Settings → Usage modal)
// @author       Rad Orlowski (https://github.com/rad-orlowski)
// @homepageURL  https://github.com/rad-orlowski/claude-pace-tracker
// @supportURL   https://github.com/rad-orlowski/claude-pace-tracker/issues
// @updateURL    https://github.com/rad-orlowski/claude-pace-tracker/raw/main/dist/claude-usage-pace.user.js
// @downloadURL  https://github.com/rad-orlowski/claude-pace-tracker/raw/main/dist/claude-usage-pace.user.js
// @license      GPL-3.0-or-later
// @match        https://claude.ai/*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      localhost
// ==/UserScript==

(() => {
  // src/userscript/log.js
  var LOG = (...args) => console.log("[claude-pace]", ...args);
  var WARN = (...args) => console.warn("[claude-pace]", ...args);

  // src/userscript/capture.js
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
    const UW = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
    if (UW.__claudeUsagePaceFetchPatched) {
      LOG("fetch already patched — skipping");
      return;
    }
    UW.__claudeUsagePaceFetchPatched = true;
    LOG("patching window.fetch");
    const orig = UW.fetch.bind(UW);
    UW.fetch = function(input, init) {
      const p = orig.apply(UW, arguments);
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

  // src/userscript/polling.js
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
      LOG("cannot start polling — orgId not yet known");
      return;
    }
    LOG("starting /usage poll every", cfg.pollIntervalMin, "min for org", orgId);
    pollTimer = setInterval(_pollUsage, cfg.pollIntervalMin * 60000);
    if (!lastJson)
      _pollUsage();
  }
  function stopPolling() {
    if (!pollTimer)
      return;
    LOG("stopping /usage poll");
    clearInterval(pollTimer);
    pollTimer = null;
  }
  function _pollUsage() {
    const orgId = getCapturedOrgId();
    if (!orgId)
      return;
    LOG("polling /usage");
    window.fetch(`/api/organizations/${orgId}/usage`, {
      headers: {
        "content-type": "application/json",
        "anthropic-client-platform": "web_claude_ai"
      },
      credentials: "include"
    }).catch((e) => {
      WARN("poll fetch threw:", e);
    });
  }

  // src/common/constants.ts
  var ACTIVE_START_H = 7;
  var ACTIVE_END_H = 20;
  var SLEEP_START_H = 23;
  var NEUTRAL_BAND_PP = 5;

  // src/userscript/constants.js
  var BUCKET_MAP = {
    five_hour: { title: "Current session", periodMs: 5 * 60 * 60 * 1000 },
    seven_day: { title: "All models", periodMs: 7 * 24 * 60 * 60 * 1000 },
    seven_day_sonnet: { title: "Sonnet", periodMs: 7 * 24 * 60 * 60 * 1000 }
  };
  var PERIOD_LEN_MS = Object.fromEntries(Object.entries(BUCKET_MAP).map(([k, v]) => [k, v.periodMs]));
  var TITLE_TO_KEY = Object.fromEntries(Object.entries(BUCKET_MAP).map(([k, v]) => [v.title, k]));

  // src/userscript/config.js
  var CFG_KEY = "__claude_pace_cfg";
  var CFG_DEFAULTS = {
    activeStartH: ACTIVE_START_H,
    activeEndH: ACTIVE_END_H,
    sleepStartH: SLEEP_START_H,
    bandWeekly: 2,
    bandSession: 5,
    pollIntervalMin: 10,
    mcpPort: 4299,
    mcpPushEnabled: true
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

  // src/common/math.ts
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
  // src/common/signals.ts
  var OVER = "over";
  var UNDER = "under";
  var MODEL_LABEL_ALL = "All-models";
  var MODEL_LABEL_SONNET = "Sonnet";
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
    SONNET_OVER: (p) => `Sonnet weekly is +${p.sonWDp}% ahead. Switch to Opus or Haiku to preserve Sonnet quota.`,
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
    return {
      session: { dp: sessDp, sev: severityOf(sessDp, bS) },
      allWeekly: {
        dp: allWDp,
        sev: severityOf(allWDp, bW),
        pct: allB.utilization
      },
      allDaily: { dp: allDDp, sev: severityOf(allDDp, bW) },
      sonnetWeekly: {
        dp: sonWDp,
        sev: severityOf(sonWDp, bW),
        pct: sonB.utilization
      },
      sonnetDaily: { dp: sonDDp, sev: severityOf(sonDDp, bW) },
      window: win,
      resetInH,
      daysLeft
    };
  }
  function isBothWeeklyOver(s) {
    return s.allWeekly.sev === OVER && s.sonnetWeekly.sev === OVER;
  }
  function isAllOverSonnetUnder(s) {
    return s.allWeekly.sev === OVER && s.sonnetWeekly.sev === UNDER;
  }
  function isAllOver(s) {
    return s.allWeekly.sev === OVER;
  }
  function isSonnetOver(s) {
    return s.sonnetWeekly.sev === OVER;
  }
  function isAnyDailyUnder(s) {
    return s.allDaily.sev === UNDER || s.sonnetDaily.sev === UNDER;
  }
  function isBothWeeklyUnder(s) {
    return s.allWeekly.sev === UNDER && s.sonnetWeekly.sev === UNDER;
  }
  var ACTIVE_RULES = [
    {
      key: "BOTH_WEEKLY_OVER",
      test: isBothWeeklyOver,
      params: (s) => ({
        allWDp: Math.round(s.allWeekly.dp),
        sonWDp: Math.round(s.sonnetWeekly.dp)
      })
    },
    {
      key: "WEEKLY_OVER_CORRECTING",
      test: (s) => s.allWeekly.sev === OVER && s.allDaily.sev === UNDER,
      params: (s) => ({ model: MODEL_LABEL_ALL, wDp: Math.round(s.allWeekly.dp) })
    },
    {
      key: "WEEKLY_OVER_CORRECTING",
      test: (s) => s.sonnetWeekly.sev === OVER && s.sonnetDaily.sev === UNDER,
      params: (s) => ({ model: MODEL_LABEL_SONNET, wDp: Math.round(s.sonnetWeekly.dp) })
    },
    {
      key: "ALL_OVER_SONNET_UNDER",
      test: isAllOverSonnetUnder,
      params: (s) => ({ allWDp: Math.round(s.allWeekly.dp) })
    },
    {
      key: "ALL_OVER",
      test: isAllOver,
      params: (s) => ({ allWDp: Math.round(s.allWeekly.dp) })
    },
    {
      key: "SONNET_OVER",
      test: isSonnetOver,
      params: (s) => ({ sonWDp: Math.round(s.sonnetWeekly.dp) })
    },
    {
      key: "SESSION_HOT_WEEKLY_SLACK",
      test: (s) => s.session.sev === OVER && isBothWeeklyUnder(s),
      params: (s) => ({
        sessDp: Math.round(s.session.dp),
        allWDp: Math.round(Math.abs(s.allWeekly.dp))
      })
    },
    {
      key: "SESSION_HOT_DAILY_SLOW",
      test: (s) => s.session.sev === OVER && isAnyDailyUnder(s),
      params: (s) => ({ sessDp: Math.round(s.session.dp) })
    },
    {
      key: "SESSION_HOT",
      test: (s, cfg) => s.session.dp > cfg.bandSession * 2,
      params: (s) => ({ sessDp: Math.round(s.session.dp) })
    },
    {
      key: "WEEKLY_UNDER_RECOVERING",
      test: (s) => s.allWeekly.sev === UNDER && s.allDaily.sev === OVER,
      params: (s) => ({
        model: MODEL_LABEL_ALL,
        wDp: Math.round(Math.abs(s.allWeekly.dp)),
        daysLeft: s.daysLeft
      })
    },
    {
      key: "WEEKLY_UNDER_RECOVERING",
      test: (s) => s.sonnetWeekly.sev === UNDER && s.sonnetDaily.sev === OVER,
      params: (s) => ({
        model: MODEL_LABEL_SONNET,
        wDp: Math.round(Math.abs(s.sonnetWeekly.dp)),
        daysLeft: s.daysLeft
      })
    },
    {
      key: "BOTH_WEEKLY_UNDER",
      test: isBothWeeklyUnder,
      params: (s) => ({
        allWDp: Math.round(Math.abs(s.allWeekly.dp)),
        sonWDp: Math.round(Math.abs(s.sonnetWeekly.dp))
      })
    },
    {
      key: "DAILY_BEHIND",
      test: isAnyDailyUnder,
      params: (s, cfg) => ({
        dayDp: Math.round(Math.abs(Math.min(s.allDaily.dp, s.sonnetDaily.dp))),
        activeEndH: cfg.activeEndH
      })
    },
    {
      key: "DAILY_OK_WEEKLY_LAGGING",
      test: (s) => s.allWeekly.sev === UNDER,
      params: (s) => ({ allWDp: Math.round(Math.abs(s.allWeekly.dp)) })
    },
    {
      key: "SONNET_LIGHT",
      test: (s) => s.sonnetWeekly.sev === UNDER,
      params: (s) => ({ sonWDp: Math.round(Math.abs(s.sonnetWeekly.dp)) })
    }
  ];
  var BONUS_RULES = [
    {
      key: "BOTH_WEEKLY_OVER",
      test: isBothWeeklyOver,
      params: (s) => ({
        allWDp: Math.round(s.allWeekly.dp),
        sonWDp: Math.round(s.sonnetWeekly.dp)
      })
    },
    {
      key: "ALL_OVER_SONNET_UNDER",
      test: isAllOverSonnetUnder,
      params: (s) => ({ allWDp: Math.round(s.allWeekly.dp) })
    },
    {
      key: "ALL_OVER",
      test: isAllOver,
      params: (s) => ({ allWDp: Math.round(s.allWeekly.dp) })
    },
    {
      key: "SONNET_OVER",
      test: isSonnetOver,
      params: (s) => ({ sonWDp: Math.round(s.sonnetWeekly.dp) })
    }
  ];
  function firstMatch(rules, s, cfg) {
    for (const r of rules) {
      if (r.test(s, cfg))
        return { key: r.key, params: r.params(s, cfg) };
    }
    return null;
  }
  function classifySituation(signals, cfg) {
    const {
      allWeekly,
      sonnetWeekly,
      allDaily,
      sonnetDaily,
      window: win,
      resetInH
    } = signals;
    if (allWeekly.pct > 90)
      return {
        key: "CRITICAL_LIMIT",
        params: { model: MODEL_LABEL_ALL, pct: Math.round(allWeekly.pct) }
      };
    if (sonnetWeekly.pct > 90)
      return {
        key: "CRITICAL_LIMIT",
        params: { model: MODEL_LABEL_SONNET, pct: Math.round(sonnetWeekly.pct) }
      };
    if (resetInH < 4 && (allWeekly.pct > 75 || sonnetWeekly.pct > 75))
      return {
        key: "RESET_TIGHT",
        params: {
          resetInH: resetInH.toFixed(1),
          pct: Math.round(Math.max(allWeekly.pct, sonnetWeekly.pct))
        }
      };
    if (resetInH < 4 && allWeekly.pct < 40 && sonnetWeekly.pct < 40)
      return {
        key: "RESET_OPPORTUNITY",
        params: {
          resetInH: resetInH.toFixed(1),
          pctLeft: Math.round(100 - allWeekly.pct)
        }
      };
    if (win === "sleep")
      return {
        key: "SLEEP",
        params: {
          allWDp: signedPp(allWeekly.dp),
          sonWDp: signedPp(sonnetWeekly.dp)
        }
      };
    if (win === "bonus") {
      if (allDaily.sev === UNDER || sonnetDaily.sev === UNDER) {
        const dayDp = Math.round(Math.abs(Math.min(allDaily.dp, sonnetDaily.dp)));
        return { key: "BONUS_CATCH_UP", params: { dayDp } };
      }
      return firstMatch(BONUS_RULES, signals, cfg) ?? {
        key: "BONUS_OK",
        params: { allWDp: signedPp(allWeekly.dp) }
      };
    }
    return firstMatch(ACTIVE_RULES, signals, cfg) ?? { key: "ALL_CLEAR", params: {} };
  }
  // src/userscript/ui/components/bar.js
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
        {
          start: day,
          end: day + activeStartH * 3600000,
          color: BAR_COLORS.sleep
        },
        {
          start: day + activeStartH * 3600000,
          end: day + activeEndH * 3600000,
          color: BAR_COLORS.active
        },
        {
          start: day + activeEndH * 3600000,
          end: day + sleepStartH * 3600000,
          color: BAR_COLORS.bonus
        },
        {
          start: day + sleepStartH * 3600000,
          end: day + 24 * 3600000,
          color: BAR_COLORS.sleep
        }
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

  // src/userscript/ui/lucide.js
  var UW = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
  var lucideReady = false;
  var lucideLoadPromise = null;
  function isLucideReady() {
    return lucideReady;
  }
  function ensureLucide() {
    if (UW.lucide) {
      lucideReady = true;
      return Promise.resolve();
    }
    if (lucideLoadPromise)
      return lucideLoadPromise;
    lucideLoadPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://unpkg.com/lucide@0.469.0/dist/umd/lucide.min.js";
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
    if (!UW.lucide)
      return;
    try {
      UW.lucide.createIcons({ nodes: [container] });
    } catch (_) {
      UW.lucide.createIcons();
    }
  }

  // src/userscript/ui/components/now-marker.js
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

  // src/userscript/ui/components/day-dividers.js
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

  // src/userscript/ui/components/pill.js
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

  // src/userscript/ui/components/summary-card.js
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

  // src/userscript/ui/dom.js
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

  // src/userscript/render.js
  var renderRetryTimer = null;
  var RENDER_RETRY_MS = 100;
  var RENDER_RETRY_MAX = 30;
  function clearRenderRetry() {
    clearTimeout(renderRetryTimer);
    renderRetryTimer = null;
  }
  function appendStat(target, iconName, value) {
    if (isLucideReady()) {
      target.appendChild(makeLucideIcon(iconName, 12));
      renderLucideIcons(target);
    }
    target.appendChild(document.createTextNode(" " + Math.round(Math.abs(value)) + "%"));
  }
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
      const nowPct = ((markerPct - mLeft) / (mRight - mLeft) * 100).toFixed(2) + "%";
      if (lineEl)
        lineEl.style.left = nowPct;
      if (capEl)
        capEl.style.left = nowPct;
    }
  }
  function renderSessionPill(pill, util, elapsedPct, band) {
    const dp = deltaPpOf(util, elapsedPct);
    const sev = severityOf(dp, band);
    pill.title = "Session pace vs time elapsed";
    const styles = sev === "over" ? PILL_OVER : sev === "under" ? PILL_UNDER : PILL_NEUTRAL;
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
      border: "1px solid rgba(136,153,187,0.25)"
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
        border: "1px solid rgba(232,184,74,0.35)"
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
      borderLeft: side === "left" ? `1px solid ${s.borderC}` : "1px solid rgba(0,0,0,0.12)",
      borderRight: side === "right" ? `1px solid ${s.borderC}` : "1px solid rgba(0,0,0,0.12)",
      borderRadius: side === "left" ? "999px 0 0 999px" : "0 999px 999px 0"
    });
    appendStat(half, dirIconName(dp, band), dp);
    return half;
  }
  function renderActivePill(pill, util, elapsedPct, now, resetsAtMs, periodMs, band, cfg) {
    const weekDp = deltaPpOf(util, elapsedPct);
    const weekSev = severityOf(weekDp, band);
    const todayExpected = todayEndExpectedPctOf(now, resetsAtMs, periodMs, cfg.activeEndH);
    const todayDp = deltaPpOf(util, todayExpected);
    const todaySev = severityOf(todayDp, band);
    Object.assign(pill.style, {
      padding: "0",
      gap: "0",
      overflow: "hidden",
      background: "none",
      border: ""
    });
    pill.appendChild(makePillHalf(weekSev, band, weekDp, "Weekly pace vs active-hours schedule", "left"));
    pill.appendChild(makePillHalf(todaySev, band, todayDp, `Today's pace target (by ${cfg.activeEndH}:00)`, "right"));
    if (isLucideReady())
      renderLucideIcons(pill);
    return null;
  }
  function renderMarkerAndPill(opts) {
    const { bucketKey, util, resetsAt, cfg } = opts;
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
    positionMarker(marker, markerPct, band);
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
      styles = renderActivePill(pill, util, elapsedPct, now, resetsAtMs, periodMs, band, cfg);
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
      if (renderMarkerAndPill({
        bucketKey: key,
        util: bucket.utilization,
        resetsAt: bucket.resets_at,
        cfg
      }))
        renderedAny = true;
    }
    const signals2 = buildSignals(json, Date.now(), cfg);
    if (signals2) {
      const section = findUsageSection();
      if (section) {
        const { key, params } = classifySituation(signals2, cfg);
        renderSummaryPanel(section, key, params);
      }
    }
    if (!renderedAny && attempt < RENDER_RETRY_MAX) {
      clearTimeout(renderRetryTimer);
      renderRetryTimer = setTimeout(() => renderAllMarkers(json, cfg, attempt + 1), RENDER_RETRY_MS);
    }
  }

  // src/userscript/ui/styles.js
  function injectPaceStyles() {
    if (document.getElementById("__claude-pace-styles"))
      return;
    const s = document.createElement("style");
    s.id = "__claude-pace-styles";
    s.textContent = ".__claude-pace-pill{transition:opacity .15s;cursor:default;user-select:none}" + ".__claude-pace-pill:hover{opacity:.8}" + ".__claude-pace-pill-half{transition:filter .12s;cursor:default}" + ".__claude-pace-pill-half:hover{filter:brightness(1.25)}";
    document.head.appendChild(s);
  }

  // src/userscript/gm-fetch.js
  function gmFetch(url, { method = "GET", headers = {}, body = undefined, timeoutMs = 1500 } = {}) {
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
        ontimeout: () => reject(new Error("timeout"))
      });
    });
  }

  // src/userscript/ui/components/mcp-section.js
  async function fetchMcpStatus(port) {
    try {
      const r = await gmFetch(`http://localhost:${port}/status`, {
        timeoutMs: 1500
      });
      if (r.status < 200 || r.status >= 300)
        return null;
      return JSON.parse(r.responseText);
    } catch {}
  }
  function fmtAge(ms) {
    if (ms == null)
      return null;
    const sec = Math.max(0, Math.floor(ms / 1000));
    if (sec < 60)
      return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60)
      return `${min}m ago`;
    return `${Math.floor(min / 60)}h ago`;
  }
  function renderMcpSection(container, getCfg2, applySettings) {
    const section = document.createElement("div");
    Object.assign(section.style, {
      marginTop: "16px",
      borderTop: "1px solid rgba(255,255,255,0.08)",
      paddingTop: "12px"
    });
    const label = document.createElement("div");
    label.textContent = "Claude Code integration";
    Object.assign(label.style, {
      fontSize: "11px",
      fontWeight: "600",
      color: "rgba(255,255,255,0.45)",
      textTransform: "uppercase",
      letterSpacing: "0.06em",
      marginBottom: "8px"
    });
    section.appendChild(label);
    const statusEl = document.createElement("div");
    Object.assign(statusEl.style, {
      fontSize: "12px",
      color: "rgba(255,255,255,0.6)",
      marginBottom: "8px"
    });
    statusEl.textContent = "Checking…";
    section.appendChild(statusEl);
    const toggleRow = document.createElement("label");
    Object.assign(toggleRow.style, {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      fontSize: "12px",
      color: "#d1d5db",
      cursor: "pointer",
      userSelect: "none"
    });
    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.checked = getCfg2().mcpPushEnabled !== false;
    toggle.onchange = () => {
      applySettings({ ...getCfg2(), mcpPushEnabled: toggle.checked });
      refresh();
    };
    const toggleLbl = document.createElement("span");
    toggleLbl.textContent = "Push pace state to local MCP server";
    toggleRow.appendChild(toggle);
    toggleRow.appendChild(toggleLbl);
    section.appendChild(toggleRow);
    container.appendChild(section);
    async function refresh() {
      const cfg = getCfg2();
      if (cfg.mcpPushEnabled === false) {
        statusEl.textContent = "MCP push disabled";
        return;
      }
      const status = await fetchMcpStatus(cfg.mcpPort);
      if (!status) {
        statusEl.textContent = `MCP not detected on :${cfg.mcpPort}`;
        return;
      }
      if (status.freshness === "no-data") {
        statusEl.textContent = `✓ Connected to MCP · waiting for first push`;
        return;
      }
      const seen = status.lastSeenAt ? fmtAge(Date.now() - Date.parse(status.lastSeenAt)) : null;
      const data = status.lastStateAt ? fmtAge(Date.now() - Date.parse(status.lastStateAt)) : null;
      statusEl.textContent = `✓ Pushing to MCP · last state ${data}${seen ? ` · seen ${seen}` : ""}`;
    }
    refresh();
  }

  // src/userscript/ui/components/settings.js
  var GEAR_ID = "__claude-pace-gear";
  var PANEL_ID = "__claude-pace-panel";
  var _gearRetryTimer = null;
  function tryInjectGear(getCfg2, applySettings, attempt = 0) {
    if (_injectSettingsGear(getCfg2, applySettings) || attempt >= 50)
      return;
    clearTimeout(_gearRetryTimer);
    _gearRetryTimer = setTimeout(() => tryInjectGear(getCfg2, applySettings, attempt + 1), 100);
  }
  function clearGearRetry() {
    clearTimeout(_gearRetryTimer);
    _gearRetryTimer = null;
  }
  var S = {
    overlay: {
      position: "fixed",
      inset: "0",
      zIndex: "99999",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(0,0,0,0.55)",
      backdropFilter: "blur(2px)"
    },
    panel: {
      background: "#1a1d24",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "12px",
      padding: "20px 24px",
      minWidth: "340px",
      boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
      fontFamily: "inherit",
      color: "#e5e7eb"
    },
    header: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: "16px"
    },
    headerTitle: { fontSize: "14px", fontWeight: "600", color: "#f9fafb" },
    closeBtn: {
      background: "none",
      border: "none",
      cursor: "pointer",
      color: "#6b7280",
      fontSize: "18px",
      lineHeight: "1",
      padding: "0 2px"
    },
    sectionLabel: {
      fontSize: "10px",
      fontWeight: "700",
      color: "#6b7280",
      textTransform: "uppercase",
      letterSpacing: "0.07em",
      marginBottom: "8px"
    },
    row: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "8px",
      marginBottom: "6px"
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
      textAlign: "center"
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
      transition: "color .12s, border-color .12s, background .12s"
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
      whiteSpace: "normal"
    }
  };
  function el(tag, styles, text) {
    const e = document.createElement(tag);
    if (styles)
      Object.assign(e.style, styles);
    if (text)
      e.textContent = text;
    return e;
  }
  function mkBtn(label, primary, danger) {
    const b = el("button", {
      padding: "5px 13px",
      borderRadius: "6px",
      fontSize: "12px",
      fontWeight: "600",
      cursor: "pointer",
      border: "none",
      transition: "opacity .12s",
      background: primary ? "#3b5bdb" : danger ? "rgba(255,90,90,0.15)" : "rgba(255,255,255,0.08)",
      color: primary ? "#fff" : danger ? "#ff7a7a" : "#9ca3af"
    }, label);
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
        background: "rgba(255,255,255,0.08)"
      });
    };
    icon.onmouseleave = () => {
      tip.style.display = "none";
      Object.assign(icon.style, {
        color: "#6b7280",
        borderColor: "rgba(255,255,255,0.18)",
        background: ""
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
    if (helpText)
      addHelpIcon(lblWrap, helpText);
    row.appendChild(lblWrap);
    const right = el("div", {
      display: "flex",
      alignItems: "center",
      gap: "5px"
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
      flexShrink: "0"
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
    const overlay = el("div", S.overlay);
    overlay.id = PANEL_ID;
    const panel = el("div", S.panel);
    const hdr = el("div", S.header);
    hdr.appendChild(el("div", S.headerTitle, "Pace indicator settings"));
    const hdrClose = el("button", S.closeBtn, "×");
    hdr.appendChild(hdrClose);
    panel.appendChild(hdr);
    const inputs = {};
    const s1 = addSection(panel, "Active window");
    addRow(s1, inputs, "activeStartH", "Start hour", cfg.activeStartH, 0, 23, "h (0–23)", "Hour when your coding day begins. Before this, no tokens are expected — the pace clock starts here each day.");
    addRow(s1, inputs, "activeEndH", "End / bonus starts", cfg.activeEndH, 0, 23, "h (0–23)", "Hour when the active window closes and the bonus window begins. The daily target badge shows whether you're on pace by this hour.");
    addRow(s1, inputs, "sleepStartH", "Sleep starts", cfg.sleepStartH, 0, 23, "h (0–23)", "Hour when the bonus window ends and sleep begins. Pace expectations freeze during sleep — you're not expected to use tokens overnight.");
    const s2 = addSection(panel, "Neutral tolerance");
    addRow(s2, inputs, "bandWeekly", "Weekly buckets", cfg.bandWeekly, 0, 20, "%pp ±", "How many percentage points off from the expected weekly pace before the badge turns red or green. Wider = more forgiving.");
    addRow(s2, inputs, "bandSession", "Session (5h)", cfg.bandSession, 0, 20, "%pp ±", "Same tolerance for the 5-hour session bucket, which resets more often and naturally varies more than the weekly view.");
    const s3 = addSection(panel, "Polling");
    addRow(s3, inputs, "pollIntervalMin", "Check interval", cfg.pollIntervalMin, 1, 120, "min", "How often the script re-fetches usage data from Claude's API in the background. Lower = more up to date, higher = fewer requests.");
    renderMcpSection(panel, () => cfg, applySettings);
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
      const newCfg = { ...cfg };
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

  // src/userscript/lifecycle.js
  function installLifecycle(onRerender, onResumePolling, onStopPolling, onResumeHeartbeat, onStopHeartbeat) {
    let rerenderInterval = null;
    let active = false;
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
    window.addEventListener("hashchange", handleNavigation);
    function onUsageView() {
      return /(^|\/)settings\/usage\/?$/.test(location.hash.replace(/^#/, "")) || /\/settings\/usage\/?$/.test(location.pathname);
    }
    function handleNavigation() {
      if (onUsageView()) {
        if (active)
          return;
        active = true;
        LOG("entered #settings/usage — activating");
        rerenderInterval = setInterval(onRerender, 30000);
        onResumePolling();
        onResumeHeartbeat?.();
        onRerender();
      } else {
        if (!active)
          return;
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
    handleNavigation();
    function teardownAll() {
      const gear = document.getElementById(GEAR_ID);
      if (gear)
        gear.remove();
      document.querySelectorAll("." + MARKER_CLASS + ", ." + PILL_CLASS + ", ." + MASK_CLASS + ", ." + SUMMARY_CLASS + ", ." + DAY_DIV_CLASS).forEach((n) => n.remove());
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

  // src/userscript/payload.js
  function trendOf(severity, window2, dp) {
    if (window2 === "sleep")
      return "sleep";
    if (window2 === "bonus" && dp < 0)
      return "catch-up";
    if (severity === "over")
      return "over";
    if (severity === "under")
      return "under";
    return "on-track";
  }
  function buildPushPayload(json, nowMs, cfg) {
    if (!json || typeof json !== "object")
      return null;
    const signals2 = buildSignals(json, nowMs, cfg);
    if (!signals2)
      return null;
    const allRA = Date.parse(json.seven_day.resets_at);
    const sonRA = Date.parse(json.seven_day_sonnet.resets_at);
    const sessRA = Date.parse(json.five_hour.resets_at);
    const wMs = 7 * 24 * 3600 * 1000;
    const sMs = 5 * 3600 * 1000;
    const allWElapsed = activeElapsedPctOf(nowMs, allRA, wMs, cfg.activeStartH, cfg.activeEndH);
    const sonWElapsed = activeElapsedPctOf(nowMs, sonRA, wMs, cfg.activeStartH, cfg.activeEndH);
    const sessElapsed = elapsedPctOf(nowMs, sessRA, sMs);
    const { key, params } = classifySituation(signals2, cfg);
    const message = (SITUATION_MESSAGES[key] || (() => key))(params);
    const win = signals2.window;
    return {
      schemaVersion: 1,
      pushedAt: new Date(nowMs).toISOString(),
      raw: {
        seven_day: {
          utilization: json.seven_day.utilization,
          resets_at: json.seven_day.resets_at
        },
        seven_day_sonnet: {
          utilization: json.seven_day_sonnet.utilization,
          resets_at: json.seven_day_sonnet.resets_at
        },
        five_hour: {
          utilization: json.five_hour.utilization,
          resets_at: json.five_hour.resets_at
        }
      },
      computed: {
        window: win,
        resetInH: signals2.resetInH,
        daysLeft: signals2.daysLeft,
        session: {
          utilizationPct: signals2.session.dp + sessElapsed,
          deltaPp: signals2.session.dp,
          elapsedPct: sessElapsed,
          trend: trendOf(signals2.session.sev, win, signals2.session.dp)
        },
        allWeekly: {
          utilizationPct: signals2.allWeekly.pct,
          deltaPp: signals2.allWeekly.dp,
          elapsedPct: allWElapsed,
          trend: trendOf(signals2.allWeekly.sev, win, signals2.allWeekly.dp)
        },
        allDaily: {
          deltaPp: signals2.allDaily.dp,
          trend: trendOf(signals2.allDaily.sev, win, signals2.allDaily.dp)
        },
        sonnetWeekly: {
          utilizationPct: signals2.sonnetWeekly.pct,
          deltaPp: signals2.sonnetWeekly.dp,
          elapsedPct: sonWElapsed,
          trend: trendOf(signals2.sonnetWeekly.sev, win, signals2.sonnetWeekly.dp)
        },
        sonnetDaily: {
          deltaPp: signals2.sonnetDaily.dp,
          trend: trendOf(signals2.sonnetDaily.sev, win, signals2.sonnetDaily.dp)
        }
      },
      situation: {
        key,
        params,
        message,
        trend: trendOf(signals2.allWeekly.sev, win, signals2.allWeekly.dp)
      }
    };
  }

  // src/userscript/mcp-push.js
  var _lastPushTs = 0;
  var _heartbeatTimer = null;
  async function pushState(json, cfg) {
    if (cfg.mcpPushEnabled === false)
      return;
    const now = Date.now();
    if (now - _lastPushTs < 1000)
      return;
    const payload = buildPushPayload(json, now, cfg);
    if (!payload)
      return;
    _lastPushTs = now;
    try {
      await gmFetch(`http://localhost:${cfg.mcpPort}/state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      LOG("mcp push skipped:", e?.message ?? e);
    }
  }
  function startHeartbeat(cfg) {
    if (cfg.mcpPushEnabled === false)
      return;
    if (_heartbeatTimer)
      return;
    const tick = async () => {
      try {
        await gmFetch(`http://localhost:${cfg.mcpPort}/heartbeat`, {
          method: "POST"
        });
      } catch {}
    };
    _heartbeatTimer = setInterval(tick, 60000);
    tick();
  }
  function stopHeartbeat() {
    if (!_heartbeatTimer)
      return;
    clearInterval(_heartbeatTimer);
    _heartbeatTimer = null;
  }

  // src/userscript/main.js
  function onUsage(json) {
    if (!json || typeof json !== "object")
      return;
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
    if (pushWasOn && !pushNowOn)
      stopHeartbeat();
    else if (!pushWasOn && pushNowOn)
      startHeartbeat(getCfg());
    rerenderMarkersFromLast();
  }
  function rerenderMarkersFromLast() {
    tryInjectGear(getCfg, applySettings);
    const last = getLastJson();
    if (last)
      renderAllMarkers(last, getCfg());
  }
  LOG("script loaded, version 4.1.0");
  installCapture(onUsage, () => {
    if (!isPolling())
      startPolling(getCfg());
  });
  function init() {
    LOG("init() — installing hooks");
    injectPaceStyles();
    installLifecycle(rerenderMarkersFromLast, () => startPolling(getCfg()), stopPolling, () => startHeartbeat(getCfg()), stopHeartbeat);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
