import { describe, expect, it } from 'vitest';
import { THREATS } from '../../src/sim/fight';
import { CANDIDATE_ROUTES, CITIES, FINISHED, LINE_RATE, MATERIALS, MODES, PUBLIC_RATE, RECIPES, REGIONS, ROUTES, SITES } from '../../src/sim/world';

// The tables are JSON since 18.1 (src/sim/data), so TypeScript no longer checks their keys and references: this does.
describe('the data tables', () => {
  const sites = new Set(SITES.map((s) => s.id));
  const materials = new Set(Object.keys(MATERIALS));

  it('keys every material by its own id, with a positive weight and a non-negative price', () => {
    // Act and assert
    for (const [k, m] of Object.entries(MATERIALS)) {
      expect(m.id).toBe(k);
      expect(m.weight).toBeGreaterThan(0);
      expect(m.price).toBeGreaterThanOrEqual(0);
      expect(['raw', 'processed', 'intermediate', 'component', 'finished']).toContain(m.tier);
    }
  });

  it('makes every recipe from known materials, and every finished round has a recipe and a rate', () => {
    // Act and assert
    for (const [k, r] of Object.entries(RECIPES)) {
      expect(r.id, k).toBe(k);
      expect(materials.has(r.output), `${k} makes ${r.output}`).toBe(true);
      for (const input of Object.keys(r.inputs)) expect(materials.has(input), `${k} needs ${input}`).toBe(true);
      for (const extra of Object.keys(r.extra ?? {})) expect(materials.has(extra), `${k} also yields ${extra}`).toBe(true);
    }
    for (const line of FINISHED) {
      expect(Object.values(RECIPES).some((r) => r.output === line), `no recipe for ${line}`).toBe(true);
      expect(LINE_RATE[line as keyof typeof LINE_RATE]).toBeGreaterThan(0);
      expect(PUBLIC_RATE[line as keyof typeof PUBLIC_RATE]).toBeTruthy();
    }
  });

  it('gives every site a unique id, a known region and only known recipes', () => {
    // Act and assert
    expect(sites.size).toBe(SITES.length);
    for (const s of SITES) {
      expect(s.region in REGIONS, `${s.id} is in ${s.region}`).toBe(true);
      expect(['state', 'private', 'foreign']).toContain(s.owner);
      for (const p of s.processes) expect(p.recipe in RECIPES, `${s.id} runs ${p.recipe}`).toBe(true);
    }
  });

  it('joins only known sites by known modes, and its cities sit in known regions', () => {
    // Act and assert
    for (const r of ROUTES) {
      expect(sites.has(r.a) && sites.has(r.b), `${r.a}–${r.b}`).toBe(true);
      expect(r.mode in MODES).toBe(true);
    }
    for (const c of CANDIDATE_ROUTES) expect(sites.has(c.a) && sites.has(c.b), c.id).toBe(true);
    for (const c of CITIES) expect(typeof c.name).toBe('string');
  });

  it('answers every threat only with rounds that exist', () => {
    // Act and assert
    for (const [k, t] of Object.entries(THREATS)) {
      expect(t.id).toBe(k);
      for (const a of t.assign) expect(FINISHED.includes(a.line), `${k} is answered by ${a.line}`).toBe(true);
    }
  });
});
