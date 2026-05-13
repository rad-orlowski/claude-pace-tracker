import { test, expect, afterEach } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeStore } from '../src/store';
import { startHttpSidecar } from '../src/http';

const PORT = 14299;
let dir:    string;
let store:  ReturnType<typeof makeStore>;
let server: ReturnType<typeof startHttpSidecar>;

async function setup() {
  dir    = await mkdtemp(join(tmpdir(), 'pace-http-'));
  store  = makeStore(join(dir, 'config.json'), join(dir, 'stats.json'));
  server = startHttpSidecar(PORT, store, async () => {});
}

async function teardown() {
  server.stop(true);
  await rm(dir, { recursive: true, force: true });
}

test('GET /status — missing credentials', async () => {
  await setup();
  const res  = await fetch(`http://localhost:${PORT}/status`);
  const body = await res.json();
  expect(res.status).toBe(200);
  expect(body.credentialsStatus).toBe('missing');
  await teardown();
});

test('POST /credentials — stores config and returns 200', async () => {
  await setup();
  const res = await fetch(`http://localhost:${PORT}/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orgId: 'org-abc', cookie: 'sessionKey=tok123' }),
  });
  expect(res.status).toBe(200);
  const cfg = await store.loadConfig();
  expect(cfg?.orgId).toBe('org-abc');
  expect(cfg?.cookie).toBe('sessionKey=tok123');
  await teardown();
});

test('POST /credentials — rejects missing fields', async () => {
  await setup();
  const res = await fetch(`http://localhost:${PORT}/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orgId: 'org-abc' }),
  });
  expect(res.status).toBe(400);
  await teardown();
});

test('GET /status — reflects valid credentials from stats', async () => {
  await setup();
  await store.saveStats({
    updatedAt: new Date().toISOString(),
    credentialsStatus: 'valid',
    situation: 'ALL_CLEAR', message: 'All good.',
    weekly: { deltaPp: -1, utilizationPct: 49, elapsedPct: 50 },
    session: { deltaPp: 0, utilizationPct: 10 },
  });
  const res  = await fetch(`http://localhost:${PORT}/status`);
  const body = await res.json();
  expect(body.credentialsStatus).toBe('valid');
  expect(body.situation).toBe('ALL_CLEAR');
  await teardown();
});
