import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { apply, validate } from '../../src/sim/actions';
import { advise, safeAdvice } from '../../src/sim/advisor';
import { RESEARCH_IDS } from '../../src/sim/strategy';
import { ACADEMY_DAYS, coverage, engineerFactor, engineerNeed, engineersMonth, workPace } from '../../src/sim/engineers';
import { OPS, opExposure, opOdds } from '../../src/sim/intelops';
import { rivalArrivals } from '../../src/sim/rival';
import { migrate, newSim } from '../../src/sim/setup';
import { advanceDays, feed, openCampaign } from '../../src/sim/tick';
import type { SimState } from '../../src/sim/types';
import { soundFor } from '../../src/ui/sound';
import { moodFor } from '../../src/ui/music';
import { TIPS, TipCard, nextTip } from '../../src/game/Tips';
import StaffPanel from '../../src/game/StaffPanel';
import IntelPanel from '../../src/game/IntelPanel';
import { KeyboardHelp } from '../../src/game/Options';

const start = (seed = 1) => openCampaign(newSim({ seed }));
const at60 = (seed = 1): SimState => ({ ...advanceDays(start(seed), 60), treasury: 5000 });
const noop = () => {};

describe('engineers', () => {
  it('a new game starts fully staffed, at full output and full pace', () => {
    const s = start();
    expect(s.engineers.staff).toBeGreaterThanOrEqual(engineerNeed(s).total);
    expect(coverage(s)).toBe(1);
    expect(engineerFactor(s)).toBe(1);
    expect(workPace(s)).toBe(1);
  });

  it('a shortage trims output by up to 15% and slows research to no less than 30%', () => {
    const s = start();
    s.engineers.staff = 0;
    expect(engineerFactor(s)).toBeCloseTo(0.85);
    expect(workPace(s)).toBe(0.3);
    s.engineers.staff = Math.floor(engineerNeed(s).total / 2);
    expect(engineerFactor(s)).toBeGreaterThan(0.9);
    expect(engineerFactor(s)).toBeLessThan(1);
  });

  it('research needs engineers, and goes slower without them', () => {
    const base = { ...start(2), treasury: 5000 };
    const r = apply(base, { type: 'research', research: RESEARCH_IDS[0] });
    if (!r.strategy.research.active) return; // that project may not be open in this world
    const full = advanceDays(r, 30);
    const short = advanceDays({ ...r, engineers: { ...r.engineers, staff: 0 } }, 30);
    expect(short.strategy.research.active!.days).toBeGreaterThan(full.strategy.research.active!.days);
  });

  it('hiring draws on the national market and costs a signing fee', () => {
    const s = { ...start(), treasury: 1000 };
    expect(validate(s, { type: 'hireEngineers', count: 0 })).toMatch(/at least one/);
    expect(validate(s, { type: 'hireEngineers', count: 10_000 })).toMatch(/Only \d+ engineers/);
    const n = apply(s, { type: 'hireEngineers', count: 20 });
    expect(n.engineers.staff).toBe(s.engineers.staff + 20);
    expect(n.engineers.market).toBe(s.engineers.market - 20);
    expect(n.treasury).toBeLessThan(s.treasury);
  });

  it('an academy takes eighteen months, one per town, then feeds the market', () => {
    const s = { ...start(), treasury: 1000 };
    const a = apply(s, { type: 'academy', town: 0 });
    expect(a.engineers.academies).toEqual([{ town: 0, days: ACADEMY_DAYS }]);
    expect(validate(a, { type: 'academy', town: 0 })).toMatch(/already/);
    expect(validate(a, { type: 'academy', town: 999 })).toMatch(/No such town/);
    const open = structuredClone(a);
    open.engineers.academies[0].days = 30;
    const closed = structuredClone(open);
    closed.engineers.academies = [];
    open.engineers.market = closed.engineers.market = 0;
    engineersMonth(open, feed);
    engineersMonth(closed, feed);
    expect(open.engineers.academies[0].days).toBe(0);
    expect(open.engineers.market).toBeGreaterThan(closed.engineers.market);
  });

  it('premium pay keeps more engineers', () => {
    const s = start();
    const std = structuredClone(s);
    const prem = apply(s, { type: 'engineerPay', level: 'premium' });
    expect(validate(prem, { type: 'engineerPay', level: 'premium' })).toBe('Already so.');
    std.engineers.staff = prem.engineers.staff = 1000;
    engineersMonth(std, feed);
    engineersMonth(prem, feed);
    expect(prem.engineers.staff).toBeGreaterThan(std.engineers.staff);
  });

  it('a long shortage warns, and the advisor says to hire', () => {
    const s = { ...start(), treasury: 2000 };
    s.engineers.staff = 10;
    s.engineers.market = 200;
    engineersMonth(s, feed);
    expect(s.feed.some((f) => /Too few engineers/.test(f.text))).toBe(true);
    const ad = advise(s, 30).find((a) => a.id === 'engineers');
    expect(ad?.action?.type).toBe('hireEngineers');
    expect(ad?.panel).toBe('staff');
  });

  it('old saves gain engineers and an intelligence service', () => {
    const s = structuredClone(start()) as Partial<SimState>;
    delete s.engineers;
    delete s.intel;
    const m = migrate(s as SimState);
    expect(m.engineers.staff).toBeGreaterThan(0);
    expect(m.intel.agency).toBe(0);
    expect(m.engineers.funded).toBe(m.engineers.staff);
    // An old tutorial save on "Keep watch" stays on "Keep watch".
    const tut = structuredClone(openCampaign(newSim({ seed: 1, scenario: 'tutorial' }))) as Partial<SimState>;
    delete tut.engineers;
    tut.tutorial = { step: 7 };
    expect(migrate(tut as SimState).tutorial!.step).toBe(9);
  });

  it('the chief of staff hires engineers when short', () => {
    const s = openCampaign(newSim({ seed: 3, automation: ['staffing'] }));
    s.engineers.staff = 20;
    s.engineers.market = 300;
    const n = advanceDays({ ...s, treasury: 3000 }, 14);
    expect(n.engineers.staff).toBeGreaterThan(20);
  });

  it('stays deterministic', () => {
    const a = advanceDays(start(7), 200);
    const b = advanceDays(start(7), 200);
    expect(a.engineers).toEqual(b.engineers);
    expect(a.intel).toEqual(b.intel);
  });
});

describe('intelligence operations', () => {
  it('needs two months, money, and one operation at a time', () => {
    const s = start();
    expect(validate(s, { type: 'intelOp', kind: 'learn' })).toMatch(/couple of months/);
    const t = at60();
    expect(validate(t, { type: 'intelOp', kind: 'nope' as never })).toMatch(/No such/);
    const n = apply(t, { type: 'intelOp', kind: 'learn' });
    expect(n.intel.active?.kind).toBe('learn');
    expect(n.treasury).toBeLessThan(t.treasury);
    expect(validate(n, { type: 'intelOp', kind: 'supply' })).toMatch(/already under way/);
    expect(validate({ ...t, treasury: 0 }, { type: 'intelOp', kind: 'learn' })).toMatch(/Not enough money/);
  });

  it('reports back after its time, with a record', () => {
    const n = apply(at60(), { type: 'intelOp', kind: 'learn' });
    const done = advanceDays(n, OPS.learn.days);
    expect(done.intel.active).toBeNull();
    expect(done.intel.record).toHaveLength(1);
    expect(done.feed.some((f) => /^Operation (succeeds|fails)/.test(f.text))).toBe(true);
  });

  it('a bigger service has better odds and less risk; a wary rival the reverse', () => {
    const s = at60();
    const odds = opOdds(s, 'delay');
    const risk = opExposure(s, 'delay');
    const up = apply(s, { type: 'intelAgency' });
    expect(up.intel.agency).toBe(1);
    expect(opOdds(up, 'delay')).toBeGreaterThan(odds);
    expect(opExposure(up, 'delay')).toBeLessThan(risk);
    const wary = structuredClone(s);
    wary.intel.alert = 3;
    expect(opOdds(wary, 'delay')).toBeLessThan(odds);
    const max = structuredClone(s);
    max.intel.agency = 3;
    expect(validate(max, { type: 'intelAgency' })).toMatch(/as good as it gets/);
  });

  it('a successful supply operation cuts attacks; an exposed one costs confidence and the allies', () => {
    let success = false;
    let exposed = false;
    for (let seed = 1; seed <= 25 && !(success && exposed); seed++) {
      const n = apply(at60(seed), { type: 'intelOp', kind: 'supply' });
      const d = advanceDays(n, OPS.supply.days);
      const r = d.intel.record[0];
      if (r.result === 'success' && !success) {
        success = true;
        expect(d.intel.supplyUntil).toBeGreaterThan(d.day);
        const before = { ...d, intel: { ...d.intel, supplyUntil: 0 } };
        expect(rivalArrivals(d, 'drone')).toBeCloseTo(rivalArrivals(before, 'drone') * 0.85);
        expect(d.intel.alert).toBeGreaterThan(0);
      }
      if (r.exposed && !exposed) {
        exposed = true;
        expect(d.feed.some((f) => /operation is exposed/.test(f.text))).toBe(true);
      }
    }
    expect(success).toBe(true);
    expect(exposed).toBe(true);
  });

  it('stolen plans report the next weapon early, but never bring it sooner', () => {
    let checked = 0;
    for (let seed = 1; seed <= 20 && checked < 2; seed++) {
      const s = at60(seed);
      if (s.rival.known.some((k) => k.fielded > s.day) || s.rival.known.length >= s.rival.order.length) continue;
      const dueBefore = s.rival.next;
      const d = advanceDays(apply(s, { type: 'intelOp', kind: 'learn' }), OPS.learn.days);
      if (d.intel.record[0].result !== 'success' || d.intel.record[0].exposed) continue;
      checked++;
      const k = d.rival.known[d.rival.known.length - 1];
      expect(k.announced).toBeLessThan(dueBefore);
      expect(k.fielded).toBe(dueBefore + 90);
      expect(d.rival.next).toBeGreaterThan(dueBefore);
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('sabotage with nothing left to hit says so', () => {
    const s = at60(2);
    s.rival.known = s.rival.order.map((id) => ({ id, announced: 0, fielded: 1 }));
    s.intel.active = { kind: 'delay', days: 1, total: 75 };
    for (let i = 0; i < 30; i++) {
      const t = structuredClone(s);
      t.rng = (t.rng + i * 7919) >>> 0;
      const d = advanceDays(t, 1);
      if (d.intel.record[0]?.result === 'success') {
        expect(d.feed.some((f) => /nothing left in development/.test(f.text))).toBe(true);
        return;
      }
    }
    throw new Error('no successful operation in 30 tries');
  });

  it('a risky operation is never in the safe advice', () => {
    const s = at60();
    const ad = advise(s, 40).find((a) => a.id === 'intel-learn');
    if (ad) expect(safeAdvice(s, 0).some((a) => a.type === 'intelOp')).toBe(false);
  });
});

describe('sound and music', () => {
  it('each kind of event has its own sound', () => {
    expect(soundFor('Strike at Corran Valley Works: production down to 30% for about 3 weeks.', 'bad')).toBe('crowd');
    expect(soundFor('Ransomware hits the control systems at X. A decision is waiting.', 'bad')).toBe('cyber');
    expect(soundFor('Power is back across the North.', 'good')).toBe('success');
    expect(soundFor('Operation succeeds: you have the rival’s plans.', 'good')).toBe('success');
    expect(soundFor('Operation fails: steal their plans. Nothing was gained.', 'warn')).toBe('failure');
    expect(soundFor('The operation is exposed. Protests follow.', 'bad')).toBe('failure');
    expect(soundFor('A spy ring is uncovered at X. A decision is waiting.', 'good')).toBe('decision');
    expect(soundFor('Sabotage at X: a line is down for a week.', 'bad')).toBe('spy');
    expect(soundFor('Research complete: hardened fuzes.', 'good')).toBe('done');
    expect(soundFor('Nothing much happens.', 'info')).toBeNull();
    expect(soundFor('Backup generators installed at X: it keeps 70% of its output through a blackout.', 'info')).toBeNull();
    expect(soundFor('New generating capacity comes on line in the North: blackouts there are rarer.', 'good')).toBeNull();
    expect(soundFor('Strikes on the grid black out the North.', 'bad')).toBe('blackout');
    expect(soundFor('Accepted: the new shell goes into service.', 'good')).toBe('done');
  });

  it('the music follows the game', () => {
    const s = start();
    expect(moodFor(s)).toBe('calm');
    expect(moodFor({ ...s, crisis: { phase: 'warning' } as never })).toBe('uneasy');
    expect(moodFor({ ...s, crisis: { phase: 'active' } as never })).toBe('tense');
    expect(moodFor({ ...s, hearing: {} as never })).toBe('hearing');
    expect(moodFor({ ...s, over: true, outcome: 'dismissed' as never })).toBe('somber');
    expect(moodFor({ ...s, over: true, outcome: 'complete' as never, confidence: 80 })).toBe('triumph');
    expect(moodFor({ ...s, over: true, outcome: 'complete' as never, confidence: 20 })).toBe('somber');
  });
});

describe('field notes', () => {
  it('shows a tip once per game, never during the tutorial or after the end', () => {
    const s = start();
    s.engineers.staff = 0;
    expect(nextTip(s)?.id).toBe('engineers');
    const seen = apply(s, { type: 'tipSeen', id: 'engineers' });
    expect(nextTip(seen)?.id).not.toBe('engineers');
    expect(validate(seen, { type: 'tipSeen', id: 'engineers' })).toMatch(/Already/);
    expect(nextTip({ ...s, over: true })).toBeNull();
    const tut = openCampaign(newSim({ seed: 1, scenario: 'tutorial' }));
    tut.engineers.staff = 0;
    expect(nextTip(tut)).toBeNull();
  });

  it('notices events in the feed', () => {
    const s = start();
    feed(s, 'bad', 'Strike at Corran Valley Works: production down to 30% for about 3 weeks.');
    expect(nextTip(s)?.id).toBe('strike');
    expect(new Set(TIPS.map((t) => t.id)).size).toBe(TIPS.length);
  });
});

describe('panels', () => {
  const busy = () => {
    const s = { ...advanceDays(start(4), 120), treasury: 3000 };
    const n = apply(apply(s, { type: 'intelOp', kind: 'delay' }), { type: 'academy', town: 0 });
    n.engineers.staff = 5;
    n.intel.record.push({ day: 90, kind: 'learn', result: 'success', exposed: true });
    return n;
  };
  const clean = (html: string) => {
    expect(html).not.toMatch(/NaN|undefined|Infinity/);
    return html;
  };

  it('the Staff tab shows engineers, academies and pay', () => {
    const html = clean(renderToString(createElement(StaffPanel, { state: busy(), act: noop })));
    expect(html).toMatch(/Engineers/);
    expect(html).toMatch(/opens in 18 months/);
    expect(html).toMatch(/Premium/);
  });

  it('the Intel tab shows operations, the one under way and the record', () => {
    const html = clean(renderToString(createElement(IntelPanel, { state: busy(), act: noop })));
    expect(html.replace(/<!-- -->/g, '')).toMatch(/Under way: sabotage a weapons programme/);
    expect(html).toMatch(/exposed/);
    expect(html).toMatch(/Grow the service/);
  });

  it('the help dialog has volume sliders, and a tip card renders', () => {
    const html = clean(renderToString(createElement(KeyboardHelp, { onClose: noop, audio: { prefs: { sfx: true, music: false, volume: 0.5, sfxVolume: 0.7 }, set: noop } })));
    expect(html).toMatch(/Music volume/);
    expect(html).toMatch(/Sounds volume/);
    const tip = clean(renderToString(createElement(TipCard, { tip: TIPS[0], onShow: noop, onDismiss: noop, onOff: noop })));
    expect(tip).toMatch(/Field notes/);
  });
});
