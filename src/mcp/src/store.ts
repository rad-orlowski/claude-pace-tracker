import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { isValidStatePayload, type StatePayload } from "./payload.js";

async function readState(path: string): Promise<StatePayload | null> {
	try {
		const raw = JSON.parse(await readFile(path, "utf8"));
		return isValidStatePayload(raw) ? raw : null;
	} catch {
		/* intentional — no cached state yet */
	}
	return null;
}

async function writeState(path: string, data: StatePayload): Promise<void> {
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, JSON.stringify(data, null, 2), "utf8");
}

export function makeStore(statePath: string) {
	return {
		loadState: () => readState(statePath),
		saveState: (s: StatePayload) => writeState(statePath, s),
	};
}

const home = homedir();
export const defaultStore = makeStore(
	join(home, ".cache", "claude-pace-tracker", "state.json"),
);
