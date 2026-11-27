// Store-page screenshots and the cover image for itch.io (20.0), taken from the running game at full size. It drives a
// headless Chrome (muted, with a throwaway profile) against the dev server, builds a game in the page with the game's own
// code (the chief of staff plays the first months), and captures each scene. Nothing is uploaded.
//
//   npm run dev                      (in another terminal; the port defaults to 5174)
//   URL=http://localhost:5174/ npx vite-node scripts/store-shots.ts
//
// Writes production/launch/itch/*.png. The cover is shot at twice its size and halved with macOS `sips`.
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const URL_ = process.env.URL ?? 'http://localhost:5174/';
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = resolve(import.meta.dirname, '..', 'production', 'launch', 'itch');
const PORT = 9333;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- a very small DevTools client ----------
let ws: WebSocket;
let nextId = 1;
const pending = new Map<number, (v: { result?: unknown; error?: { message: string } }) => void>();
function send<T = Record<string, unknown>>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((res, rej) =>
    pending.set(id, (m) => (m.error ? rej(new Error(`${method}: ${m.error.message}`)) : res(m.result as T))),
  );
}
async function evaluate<T = unknown>(expression: string): Promise<T> {
  const r = await send<{ result: { value: T }; exceptionDetails?: { exception?: { description?: string } } }>('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'evaluate failed');
  return r.result.value;
}
async function size(width: number, height: number) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
}
async function go(url: string) {
  await send('Page.navigate', { url });
  await sleep(2500);
}
async function shot(name: string) {
  const { data } = await send<{ data: string }>('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(OUT, name), Buffer.from(data, 'base64'));
  console.log(`  ${name}`);
}
/** Clicks the first visible button whose text is this, or starts with it (title buttons carry a second line). */
async function clickText(text: string) {
  const ok = await evaluate<boolean>(`(() => {
    const t = ${JSON.stringify(text)};
    const all = [...document.querySelectorAll('button, a, [role=button], [role=radio]')].filter((e) => e.getBoundingClientRect().width > 0);
    const el = all.find((e) => e.textContent.trim() === t) ?? all.find((e) => e.textContent.trim().startsWith(t));
    if (!el) return false;
    el.click();
    return true;
  })()`);
  if (!ok) throw new Error(`No "${text}" to click`);
  await sleep(900);
}
async function key(k: string, code = k) {
  for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: k, code, text: type === 'keyDown' && k.length === 1 ? k : undefined });
}
async function typeText(t: string) {
  await send('Input.insertText', { text: t });
}

/** Builds a game in the page and saves it as the autosave. `endIn` leaves that many days of the term. */
async function prepare(opts: { seed: number; scenario: string; autoDays: number; handDays: number; months?: number; endIn?: number }) {
  await go(URL_);
  await evaluate(`(async () => {
    const { newSim } = await import('/src/sim/setup.ts');
    const { advanceDays, openCampaign } = await import('/src/sim/tick.ts');
    const { newAutomation, AUTO_AREA_IDS } = await import('/src/sim/automation.ts');
    let s = openCampaign(newSim({ seed: ${opts.seed}, scenario: ${JSON.stringify(opts.scenario)}${opts.months ? `, months: ${opts.months}` : ''} }));
    s.automation = newAutomation(AUTO_AREA_IDS);
    s = advanceDays(s, ${opts.autoDays});
    s.automation = newAutomation([]);
    s = advanceDays(s, ${opts.handDays});
    ${opts.endIn ? `s = advanceDays(s, Math.max(0, s.days - s.day - ${opts.endIn}));` : ''}
    localStorage.setItem('forge-command-2-autosave', JSON.stringify(s));
    localStorage.setItem('forge-command-audio', JSON.stringify({ sfx: false, music: false }));
    localStorage.setItem('forge-command-tips', 'off');
    return s.day;
  })()`);
  await go(URL_);
  await clickText('Continue');
  await sleep(2500);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const profile = mkdtempSync(join(tmpdir(), 'forge-shots-'));
  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--mute-audio', '--no-first-run', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
  try {
    let target: { webSocketDebuggerUrl: string; type: string } | undefined;
    for (let i = 0; i < 40 && !target; i++) {
      await sleep(250);
      target = await fetch(`http://127.0.0.1:${PORT}/json/list`)
        .then((r) => r.json() as Promise<{ webSocketDebuggerUrl: string; type: string }[]>)
        .then((l) => l.find((t) => t.type === 'page'))
        .catch(() => undefined);
    }
    if (!target) throw new Error('Chrome did not start');
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener('open', r, { once: true }));
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(String(e.data)) as { id?: number };
      if (m.id && pending.has(m.id)) {
        pending.get(m.id)!(m as never);
        pending.delete(m.id);
      }
    });
    await send('Page.enable');
    await send('Runtime.enable');

    // The cover: the title screen at 1260×500·2, halved to 630×500 below.
    await size(1260, 1000);
    await go(URL_);
    await evaluate(`localStorage.setItem('forge-command-audio', JSON.stringify({ sfx: false, music: false }))`);
    await go(URL_);
    await sleep(1500);
    // The cover is the emblem, the title and the skyline: the menu and the small print are hidden for it.
    await evaluate(`document.querySelectorAll('nav[aria-label="Main menu"], footer').forEach((e) => (e.style.visibility = 'hidden'))`);
    await sleep(300);
    await shot('cover-2x.png');

    await size(1920, 1080);
    // 1. Most of a year into a war: Home, the advice and the map (before the year-end hearing).
    await prepare({ seed: 11, scenario: 'warFooting', autoDays: 300, handDays: 40 });
    await shot('1-home-and-map.png');
    // 2. An arsenal open: production lines and their parts.
    await key('/', 'Slash');
    await sleep(400);
    await typeText('Corran Valley');
    await sleep(500);
    await key('Enter');
    await sleep(1500);
    await shot('2-arsenal.png');
    // 3. The Board's decisions, if any are waiting; otherwise the Supply tab.
    const board = await evaluate<boolean>(`!![...document.querySelectorAll('button')].find((b) => /\\d+ decision/.test(b.textContent))`);
    if (board) {
      await evaluate(`[...document.querySelectorAll('button')].find((b) => /\\d+ decision/.test(b.textContent)).click()`);
      await sleep(1200);
    } else await clickText('Supply');
    await shot(board ? '3-board.png' : '3-supply.png');
    // 4. The budget hearing at the end of the year.
    await prepare({ seed: 11, scenario: 'warFooting', autoDays: 300, handDays: 75 });
    await shot('4-hearing.png');
    // 5. The new-game screen.
    await go(URL_);
    await clickText('New game');
    await sleep(800);
    await shot('5-new-game.png');
    // 6. The end of a term: the report.
    await prepare({ seed: 5, scenario: 'standard', autoDays: 300, handDays: 0, months: 12, endIn: 2 });
    await key(' ', 'Space');
    await sleep(4000);
    await shot('6-term-report.png');
  } finally {
    ws?.close();
    chrome.kill();
    await sleep(500);
    rmSync(profile, { recursive: true, force: true });
  }
  execFileSync('sips', ['-z', '500', '630', join(OUT, 'cover-2x.png'), '--out', join(OUT, 'cover.png')], { stdio: 'ignore' });
  rmSync(join(OUT, 'cover-2x.png'));
  console.log(`Written to ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
