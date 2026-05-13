import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const header = readFileSync('./meta.txt', 'utf8').trimEnd();

async function bundle(minify: boolean): Promise<string> {
  const result = await Bun.build({
    entrypoints: ['./src/userscript/main.js'],
    format: 'iife',
    target: 'browser',
    minify,
  });
  if (!result.success) {
    for (const log of result.logs) console.error(log);
    process.exit(1);
  }
  return await result.outputs[0].text();
}

mkdirSync('./dist', { recursive: true });

const readable = await bundle(false);
writeFileSync('./dist/claude-usage-pace.user.js', header + '\n\n' + readable);
console.log('dist/claude-usage-pace.user.js written');

const minified = await bundle(true);
writeFileSync('./dist/claude-usage-pace.min.user.js', header + '\n' + minified);
console.log('dist/claude-usage-pace.min.user.js written');