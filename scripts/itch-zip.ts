// Packs the itch.io build (npm run build:itch) into release/forge-command-<version>-itch.zip, ready to upload by hand
// as an HTML game. It checks first what itch.io needs: index.html at the top of the zip, every path relative (itch serves
// the game from a folder of its own), and no service worker. It uploads nothing.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'dist-itch');
const version = (JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { version: string }).version;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

const problems: string[] = [];
const index = join(dist, 'index.html');
if (!existsSync(index)) problems.push('dist-itch/index.html is missing: run the build first.');
else {
  const html = readFileSync(index, 'utf8');
  // An absolute path ("/assets/…") points at the root of itch's server, not at the game's folder.
  const absolute = [...html.matchAll(/(?:src|href)="(\/[^"/][^"]*)"/g)].map((m) => m[1]);
  if (absolute.length) problems.push(`index.html has absolute paths: ${absolute.join(', ')}`);
}
if (existsSync(join(dist, 'sw.js'))) problems.push('dist-itch/sw.js exists: the itch build must not ship a service worker.');
const all = existsSync(dist) ? files(dist) : [];
// itch.io's limits for an HTML upload: at most 1,000 files, none over 200 MB.
if (all.length > 1000) problems.push(`${all.length} files: itch.io takes at most 1,000.`);
for (const f of all) if (statSync(f).size > 200 * 1024 * 1024) problems.push(`${f} is over 200 MB.`);

if (problems.length) {
  console.error(`The itch.io build is not ready:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}

mkdirSync(join(root, 'release'), { recursive: true });
const out = join(root, 'release', `forge-command-${version}-itch.zip`);
rmSync(out, { force: true });
execFileSync('zip', ['-r', '-q', '-X', out, '.'], { cwd: dist });
const mb = (statSync(out).size / 1024 / 1024).toFixed(1);
console.log(`Ready to upload by hand: release/forge-command-${version}-itch.zip (${all.length} files, ${mb} MB).`);
