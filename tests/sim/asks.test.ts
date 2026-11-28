// The Committee's short asks (20.4, design pass C4): issued every few months in scored games, rewarded when met, a
// little costly when missed, and never in the sandbox or the story.
import { describe, expect, it } from 'vitest';
import { newSim } from '../../src/sim/setup';
import { advanceDays, openCampaign } from '../../src/sim/tick';
import { askDay, askMet, askText } from '../../src/sim/asks';
import T from '../../src/sim/tuning/mandate.json';
import type { SimState } from '../../src/sim/types';

const A = T.asks;
const quiet = () => undefined;
/** A game just past the month the first ask is issued. */
const firstAsk = (opts: Parameters<typeof newSim>[0]) => advanceDays(openCampaign(newSim(opts)), A.firstMonth * 30 + 1);

describe('the Committee asks', () => {
  it('asks for one concrete thing with a deadline in a scored game', () => {
    const s = firstAsk({ seed: 3 });
    const a = s.strategy.ask;
    expect(a).toBeTruthy();
    expect(['reserve', 'source']).toContain(a!.kind);
    expect(a!.by - a!.issued).toBe(A.days);
    expect(askText(s, a!).title.length).toBeGreaterThan(10);
  });

  it('asks nothing in the sandbox or the story', () => {
    expect(firstAsk({ seed: 3, mode: 'sandbox' }).strategy.ask ?? null).toBeNull();
    expect(firstAsk({ seed: 3, story: true }).strategy.ask ?? null).toBeNull();
  });

  it('pays the reward when the ask is met, and takes a little confidence when it is missed', () => {
    const base = firstAsk({ seed: 3 });
    expect(base.strategy.ask?.kind).toBe('reserve');

    // Met: a target already reached.
    const met = structuredClone(base) as SimState;
    if (met.strategy.ask?.kind === 'reserve') met.strategy.ask.target = 0.01;
    expect(askMet(met, met.strategy.ask!)).toBe(true);
    const [t0, c0] = [met.treasury, met.confidence];
    askDay(met, quiet);
    expect(met.strategy.ask).toBeNull();
    expect(met.treasury).toBeCloseTo(t0 + A.money, 6);
    expect(met.confidence).toBeCloseTo(Math.min(100, c0 + A.confidence), 6);

    // Missed: past the deadline and short of the target.
    const missed = structuredClone(base) as SimState;
    if (missed.strategy.ask?.kind === 'reserve') missed.strategy.ask.target = 9;
    missed.strategy.ask!.by = missed.day;
    const c1 = missed.confidence;
    askDay(missed, quiet);
    expect(missed.strategy.ask).toBeNull();
    expect(missed.confidence).toBeCloseTo(Math.max(0, c1 - A.missedConfidence), 6);
  });

  it('issues the same ask every time for the same game', () => {
    expect(firstAsk({ seed: 8 }).strategy.ask).toEqual(firstAsk({ seed: 8 }).strategy.ask);
  });
});
