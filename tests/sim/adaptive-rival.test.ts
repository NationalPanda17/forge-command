// Release 19.0a: the rival studies your stockpile and develops what you are least ready for (docs/depth.md).
import { describe, expect, it } from 'vitest';
import { chooseNext, DEVELOPMENTS, exposure, rivalMonth, type DevId } from '../../src/sim/rival';
import { newSim } from '../../src/sim/setup';
import { advanceDays, openCampaign } from '../../src/sim/tick';
import type { SimState } from '../../src/sim/types';
import type { LineId } from '../../src/sim/world';

const start = (seed = 1, scenario: SimState['scenario'] = 'standard') => ({ ...openCampaign(newSim({ seed, scenario })), treasury: 20000 });

/** The line most exposed to a development, and only to it among the rival's weapons where possible. */
function mostExposed(id: DevId): LineId {
  const ex = exposure(DEVELOPMENTS[id]);
  return (Object.entries(ex) as [LineId, number][]).sort((a, b) => b[1] - a[1])[0][0];
}

describe('the adaptive rival', () => {
  it('is deterministic: the same seed gives the same developments, days and reasons', () => {
    const a = advanceDays(start(3), 900).rival;
    const b = advanceDays(start(3), 900).rival;
    expect(a.known.length).toBeGreaterThan(1);
    expect(b.known).toEqual(a.known);
    expect(b.order).toEqual(a.order);
  });

  it('draws no random numbers to choose', () => {
    const s = start(5);
    const before = s.rng;
    chooseNext(s);
    expect(s.rng).toBe(before);
  });

  it('keeps every development exactly once in its order', () => {
    const r = advanceDays(start(2), 1400).rival;
    expect(new Set(r.order).size).toBe(Object.keys(DEVELOPMENTS).length);
    expect(r.order.slice(0, r.known.length)).toEqual(r.known.map((k) => k.id));
  });

  it('aims at a line it has watched run thin', () => {
    const s = start(1);
    for (const id of Object.keys(DEVELOPMENTS) as DevId[]) {
      const line = mostExposed(id);
      if (!s.lines[line]?.unlocked) continue;
      // Every unlocked line full, except the one this development bites hardest.
      const watch: Partial<Record<LineId, number>> = {};
      for (const l of Object.keys(s.lines) as LineId[]) watch[l] = 1;
      watch[line] = 0.1;
      s.rival = { ...s.rival, watch, known: [] };
      const c = chooseNext(s)!;
      const ex = exposure(DEVELOPMENTS[c.id]);
      expect(ex[line] ?? 0, `${id} via ${line} chose ${c.id}`).toBeGreaterThan(0);
    }
  });

  it('names the thin lines in its reason', () => {
    const s = start(1);
    const line = mostExposed('swarms');
    const watch: Partial<Record<LineId, number>> = {};
    for (const l of Object.keys(s.lines) as LineId[]) watch[l] = 1;
    watch[line] = 0.2;
    s.rival = { ...s.rival, watch, known: [] };
    const c = chooseNext(s)!;
    expect(c.why).toMatch(/at 20% of target/);
  });

  it('is less keen on a development you already hold the counter to', () => {
    const s = start(1);
    const line = mostExposed('swarms');
    const watch: Partial<Record<LineId, number>> = {};
    for (const l of Object.keys(s.lines) as LineId[]) watch[l] = 1;
    watch[line] = 0.5;
    s.rival = { ...s.rival, watch, known: [] };
    const first = chooseNext(s)!;
    s.strategy = { ...s.strategy, research: { ...s.strategy.research, done: [...s.strategy.research.done, DEVELOPMENTS[first.id].counter] } };
    const second = chooseNext(s)!;
    // Either it turns elsewhere, or it says it chose it despite the counter.
    if (second.id === first.id) expect(second.why).toMatch(/despite your counter/);
    else expect(second.id).not.toBe(first.id);
  });

  it('watches the stockpile month by month, smoothed', () => {
    const s = advanceDays(start(1), 200);
    const w = s.rival.watch ?? {};
    const vals = Object.values(w);
    expect(vals.length).toBeGreaterThan(0);
    for (const v of vals) expect(v).toBeGreaterThanOrEqual(0), expect(v).toBeLessThanOrEqual(1);
    const before = { ...w };
    rivalMonth(s);
    for (const [l, v] of Object.entries(s.rival.watch!)) if (before[l as LineId] !== undefined) expect(Math.abs(v - before[l as LineId]!)).toBeLessThanOrEqual(0.4 + 1e-9);
  });

  it('keeps the scripted order in the tutorial', () => {
    const s = start(1, 'tutorial');
    const order = [...s.rival.order];
    const t = advanceDays(s, 900);
    expect(t.rival.order).toEqual(order);
    expect(t.rival.watch).toBeUndefined();
    for (const k of t.rival.known) expect(k.why).toBeUndefined();
  });
});
