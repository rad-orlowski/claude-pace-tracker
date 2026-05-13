import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface Config {
  orgId:  string;
  cookie: string;
}

export interface Stats {
  updatedAt:          string;
  credentialsStatus:  'valid' | 'expired' | 'missing';
  situation:          string | null;
  message:            string | null;
  weekly:             { deltaPp: number; utilizationPct: number; elapsedPct: number };
  session:            { deltaPp: number; utilizationPct: number };
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch {
    return null;
  }
}

async function writeJson(path: string, data: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2), 'utf8');
}

export function makeStore(configPath: string, statsPath: string) {
  return {
    loadConfig: () => readJson<Config>(configPath),
    saveConfig: (c: Config) => writeJson(configPath, c),
    loadStats:  () => readJson<Stats>(statsPath),
    saveStats:  (s: Stats) => writeJson(statsPath, s),
  };
}

const home = homedir();
export const defaultStore = makeStore(
  join(home, '.config', 'claude-pace-tracker', 'config.json'),
  join(home, '.cache',  'claude-pace-tracker', 'stats.json'),
);
