import { afterAll, describe, expect, it } from 'vitest';
import { pathBetween } from '../../src/sim/graph';
import { readiness } from '../../src/sim/selectors';
import { newSim } from '../../src/sim/setup';
import { advanceDays, openCampaign } from '../../src/sim/tick';
import { CITIES, SITES } from '../../src/sim/world';
import { applyWorld, countryName, tr } from '../../src/sim/worldgen';
import * as G from '../../src/ui/map/geo';

const CLASSIC = Object.fromEntries(SITES.map((s) => [s.id, { x: s.x, y: s.y, name: s.name }]));
const CLASSIC_CITIES = CITIES.map((c) => c.name);
const onSheet = (x: number, y: number) => x >= G.FRAME.x0 && x <= G.FRAME.x1 && y >= G.FRAME.y0 && y <= G.FRAME.y1;
const SEEDS = Array.from({ length: 24 }, (_, i) => 1000 + i * 7919);
/** Sites that sit on land (or at the water's edge) on the classic map. Offshore gas is meant to be at sea. */
let ASHORE = new Set<string>();

/** Ports and island sites sit at the water's edge: allow a few km of slack for them. */
function nearLand(x: number, y: number, slack: number): boolean {
  if (G.onLand(x, y)) return true;
  for (let a = 0; a < 16; a++) for (const r of [slack / 2, slack]) if (G.onLand(x + Math.cos((a / 16) * Math.PI * 2) * r, y + Math.sin((a / 16) * Math.PI * 2) * r)) return true;
  return false;
}

afterAll(() => applyWorld(null));

describe('procedural worlds', () => {
  it('the classic map is untouched until a world is chosen', () => {
    applyWorld(null);
    ASHORE = new Set(SITES.filter((s) => onSheet(s.x, s.y) && nearLand(s.x, s.y, s.kind === 'port' || s.region === 'isles' ? 14 : 6)).map((s) => s.id));
    for (const s of SITES) expect([s.x, s.y, s.name]).toEqual([CLASSIC[s.id].x, CLASSIC[s.id].y, CLASSIC[s.id].name]);
    expect(countryName()).toBe('Aldmere');
  });

  it('every generated world keeps its sites on land, inside the sheet, and reachable', () => {
    for (const seed of SEEDS) {
      applyWorld(seed);
      for (const s of SITES) {
        if (!onSheet(CLASSIC[s.id].x, CLASSIC[s.id].y)) {
          // Foreign suppliers stay where they were, off the sheet.
          expect([s.x, s.y]).toEqual([CLASSIC[s.id].x, CLASSIC[s.id].y]);
          continue;
        }
        expect(onSheet(s.x, s.y), `${seed} ${s.id} off the sheet`).toBe(true);
        if (s.kind !== 'plot' && ASHORE.has(s.id)) expect(nearLand(s.x, s.y, s.kind === 'port' || s.region === 'isles' ? 14 : 6), `${seed} ${s.id} at ${s.x},${s.y} in the sea`).toBe(true);
      }
      for (const s of SITES) if (s.kind !== 'plot') expect(pathBetween('depotCentral', s.id) ?? pathBetween('depotCentral', s.id, true), `${seed} ${s.id} unreachable`).not.toBeNull();
    }
  });

  it('renames every place, keeps names unique, and moves things', () => {
    for (const seed of SEEDS.slice(0, 8)) {
      applyWorld(seed);
      const names = SITES.map((s) => s.name);
      expect(new Set(names).size).toBe(names.length);
      expect(countryName()).not.toBe('Aldmere');
      for (const c of CITIES) expect(CLASSIC_CITIES).not.toContain(c.name);
      expect(tr('Corran Valley Works')).not.toContain('Corran');
      const moved = SITES.filter((s) => onSheet(CLASSIC[s.id].x, CLASSIC[s.id].y) && Math.hypot(s.x - CLASSIC[s.id].x, s.y - CLASSIC[s.id].y) > 10).length;
      expect(moved).toBeGreaterThan(SITES.length / 3);
    }
  });

  it('the same seed always makes the same world', () => {
    applyWorld(SEEDS[3]);
    const a = SITES.map((s) => `${s.name}@${s.x},${s.y}`).join('|');
    applyWorld(null);
    applyWorld(SEEDS[3]);
    expect(SITES.map((s) => `${s.name}@${s.x},${s.y}`).join('|')).toBe(a);
  });

  it('a campaign plays through on a generated world, and saves record it', () => {
    let s = openCampaign(newSim({ seed: 5, world: SEEDS[5] }));
    expect(s.world).toBe(SEEDS[5]);
    s = advanceDays(s, 360);
    expect(Number.isFinite(s.treasury)).toBe(true);
    expect(readiness(s)).toBeGreaterThan(0.3);
    // The story and the tutorial stay on the classic map.
    expect(newSim({ seed: 1, story: true, world: 99 }).world).toBeNull();
    applyWorld(null);
  });
});
