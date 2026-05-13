#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { defaultStore, makeStore } from './store.js';
import { Poller } from './poller.js';
import { startHttpSidecar } from './http.js';
import { ACTIVE_START_H, ACTIVE_END_H, SLEEP_START_H } from './constants.js';

const POLL_MIN  = Number(process.env.PACE_POLL_INTERVAL_MIN ?? '5');
const HTTP_PORT = Number(process.env.PACE_HTTP_PORT         ?? '4299');

const CFG = { activeStartH: ACTIVE_START_H, activeEndH: ACTIVE_END_H, sleepStartH: SLEEP_START_H, bandWeekly: 2, bandSession: 5 };

// ─── Exported handler functions (pure logic, injectable store for testing) ────

type Store = ReturnType<typeof makeStore>;

export async function getPaceStatsHandler(store: Store, triggerPoll?: () => Promise<void>) {
  let stats = await store.loadStats();
  if (!stats && triggerPoll) {
    await triggerPoll();
    stats = await store.loadStats();
  }
  if (!stats) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'No data yet — poller has not completed a cycle. Try again in a moment.' }) }] };
  }
  if (stats.credentialsStatus === 'expired') {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Credentials expired. Visit claude.ai/settings/usage and click "Reconnect to Claude Code" in the pace tracker gear panel.' }) }], isError: true };
  }
  if (stats.credentialsStatus === 'missing') {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'No credentials. Visit claude.ai/settings/usage and click "Connect to Claude Code" in the pace tracker gear panel.' }) }], isError: true };
  }
  return { content: [{ type: 'text' as const, text: JSON.stringify(stats) }] };
}

export async function getSituationHandler(store: Store, triggerPoll?: () => Promise<void>) {
  let stats = await store.loadStats();
  if (!stats && triggerPoll) {
    await triggerPoll();
    stats = await store.loadStats();
  }
  if (!stats) {
    return { content: [{ type: 'text' as const, text: 'No data yet — poller has not completed a cycle.' }] };
  }
  if (stats.credentialsStatus !== 'valid') {
    return {
      content: [{ type: 'text' as const, text: `Credentials ${stats.credentialsStatus}. Visit claude.ai/settings/usage and click Connect/Reconnect in the pace tracker gear panel.` }],
      isError: true,
    };
  }
  const ageMin = Math.round((Date.now() - Date.parse(stats.updatedAt)) / 60000);
  const meta   = `[credentials: valid, data: ${ageMin}m ago]`;
  return { content: [{ type: 'text' as const, text: `${stats.situation}: ${stats.message}\n${meta}` }] };
}

// ─── MCP server setup ─────────────────────────────────────────────────────────

const poller = new Poller(defaultStore, CFG);

const httpServer = startHttpSidecar(HTTP_PORT, defaultStore, async () => {
  poller.stop();
  poller.start(POLL_MIN);
});

poller.start(POLL_MIN);

const server = new McpServer({ name: 'pace-tracker', version: '1.0.0' });

server.tool(
  'get_pace_stats',
  'Get current Claude usage pace statistics (weekly and session buckets, pace delta, situation)',
  {},
  async () => getPaceStatsHandler(defaultStore, () => poller.poll()),
);

server.tool(
  'get_situation',
  'Get the current pace situation classification and advisory message',
  {},
  async () => getSituationHandler(defaultStore, () => poller.poll()),
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[pace-mcp] running — HTTP sidecar on :${HTTP_PORT}, polling every ${POLL_MIN}min`);
}

main().catch((err) => {
  console.error('[pace-mcp] fatal:', err);
  process.exit(1);
});
