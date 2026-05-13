import { buildSignals, classifySituation, resolveSituation, SignalsCfg } from './signals.js';
import { makeStore, Stats } from './store.js';

type Store = ReturnType<typeof makeStore>;
type FetchFn = typeof fetch;

export class Poller {
  private store:   Store;
  private cfg:     SignalsCfg;
  private fetchFn: FetchFn;
  private timer:   ReturnType<typeof setInterval> | null = null;

  constructor(store: Store, cfg: SignalsCfg, fetchFn: FetchFn = fetch) {
    this.store   = store;
    this.cfg     = cfg;
    this.fetchFn = fetchFn;
  }

  start(intervalMin: number): void {
    if (this.timer) return;
    this.poll();
    this.timer = setInterval(() => this.poll(), intervalMin * 60_000);
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  async poll(): Promise<void> {
    const config = await this.store.loadConfig();
    if (!config) return;

    let res: Response;
    try {
      res = await this.fetchFn(
        `https://claude.ai/api/organizations/${config.orgId}/usage`,
        { headers: { 'Cookie': config.cookie, 'content-type': 'application/json', 'anthropic-client-platform': 'web_claude_ai' } },
      );
    } catch (err) {
      console.error('[pace-mcp] fetch error:', err);
      return;
    }

    if (res.status === 401) {
      const existing = await this.store.loadStats();
      await this.store.saveStats({
        ...(existing ?? { weekly: { deltaPp: 0, utilizationPct: 0, elapsedPct: 0 }, session: { deltaPp: 0, utilizationPct: 0 } }),
        updatedAt:         new Date().toISOString(),
        credentialsStatus: 'expired',
        situation:         existing?.situation ?? null,
        message:           existing?.message   ?? null,
      });
      console.error('[pace-mcp] credentials expired (401)');
      return;
    }

    if (!res.ok) {
      console.error('[pace-mcp] non-OK response:', res.status);
      return;
    }

    let json: any;
    try { json = await res.json(); }
    catch { console.error('[pace-mcp] failed to parse JSON'); return; }

    const now     = Date.now();
    const signals = buildSignals(json, now, this.cfg);
    if (!signals) { console.error('[pace-mcp] buildSignals returned null'); return; }

    const { key }  = classifySituation(signals, this.cfg);
    const message  = resolveSituation(signals, this.cfg);
    const allB     = json.seven_day;
    const sessB    = json.five_hour;

    const stats: Stats = {
      updatedAt:         new Date().toISOString(),
      credentialsStatus: 'valid',
      situation:         key,
      message,
      weekly:  { deltaPp: signals.allWeekly.dp, utilizationPct: allB.utilization, elapsedPct: signals.allWeekly.dp + (allB.utilization - signals.allWeekly.dp) },
      session: { deltaPp: signals.session.dp,   utilizationPct: sessB.utilization },
    };
    await this.store.saveStats(stats);
    console.error('[pace-mcp] polled OK — situation:', key);
  }
}
