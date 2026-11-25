import { describe, expect, it } from 'vitest';
import { apply, validate } from '../../src/sim/actions';
import { diagnose, safeAdvice } from '../../src/sim/advisor';
import { AUTO_AREA_IDS, PRESETS, automationOn, proposals, recommend } from '../../src/sim/automation';
import { newSim } from '../../src/sim/setup';
import { advanceDays, openCampaign } from '../../src/sim/tick';
import { nationalStock, reserveTarget } from '../../src/sim/selectors';
import { active } from '../../scripts/director';

const start = (seed = 1, automation: typeof PRESETS.full = []) => ({ ...openCampaign(newSim({ seed, automation })) });

describe('the chief of staff', () => {
  it('is off unless asked for, and never in a two-player game or the tutorial', () => {
    expect(automationOn(start())).toBe(false);
    expect(automationOn(start(1, PRESETS.assist))).toBe(true);
    const hs = openCampaign(newSim({ seed: 2, hotseat: ['A', 'B'], automation: PRESETS.full }));
    expect(automationOn(hs)).toBe(false);
    expect(validate(hs, { type: 'automate', area: 'staffing', on: true })).toMatch(/two-player/);
    expect(automationOn(openCampaign(newSim({ seed: 2, scenario: 'tutorial', automation: PRESETS.full })))).toBe(false);
  });

  it('on full autopilot, runs the game: decisions answered, hearings settled, a log kept', () => {
    const s = advanceDays(start(3, PRESETS.full), 400);
    expect(s.automation.log.length).toBeGreaterThan(10);
    expect(s.hearing).toBeNull();
    expect(s.strategy.decisions.length).toBe(0);
    expect(s.history.some((h) => (h.decisions ?? []).length > 0)).toBe(true);
    expect(s.automation.assisted).toBe(true);
  });

  it('a hearing never holds the clock while decisions are handed over', () => {
    const s = advanceDays(start(4, ['decisions']), 360, { stopOnHold: true });
    expect(s.day).toBe(360);
    expect(s.hearing).toBeNull();
  });

  it('never spends below the reserve', () => {
    const s = { ...start(5), treasury: 900 };
    for (const area of AUTO_AREA_IDS) {
      const spending = proposals(s, area, 1e6).filter((a) => ['expand', 'invest', 'generator', 'cyberDefence', 'cyberBackups', 'auditTeam', 'tradeMission', 'vet', 'communityFund', 'payDeal', 'research', 'hireStaff', 'qualify', 'housing', 'safety', 'inhouse', 'build', 'refurbish'].includes(a.type));
      expect(spending, area).toEqual([]);
    }
  });

  it('the stance changes what it does: saving money idles overstock sooner', () => {
    const s = start(6);
    const line = 'pac3';
    // Put PAC-3 at 1.4 times target.
    const want = reserveTarget(s, line) * 1.4 - nationalStock(s, line);
    s.sites.depotCentral.lots[line] = [...(s.sites.depotCentral.lots[line] ?? []), { qty: Math.max(0, Math.round(want)), made: 0, until: 9999 }];
    const idles = (stance: 'balanced' | 'thrift') => proposals(s, 'production', 0, stance).some((a) => a.type === 'setRun' && a.run === 'idle');
    expect(idles('thrift')).toBe(true);
    expect(idles('balanced')).toBe(false);
  });

  it('the test player is the chief of staff with everything handed over', () => {
    const s = advanceDays(start(7), 60);
    expect(active(s)).toEqual(AUTO_AREA_IDS.flatMap((a) => proposals(s, a, 0, 'balanced')));
  });
});

describe('the advisor', () => {
  it('recommends a real option, with a reason, for every decision card that comes up', () => {
    let s = { ...start(8), treasury: 5000 };
    let seen = 0;
    for (let m = 0; m < 30; m++) {
      for (const d of s.strategy.decisions) {
        const r = recommend(s, d);
        expect(d.options.some((o) => o.id === r.option), d.kind).toBe(true);
        expect(r.why.length).toBeGreaterThan(5);
        seen++;
      }
      s = advanceDays(s, 30);
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('safe advice keeps the treasury above the reserve, and taking it is allowed', () => {
    const s = advanceDays(start(9), 150);
    s.automation.reserve = s.treasury - 50;
    let t = s;
    for (const a of safeAdvice(s)) {
      expect(validate(t, a)).toBeNull();
      t = apply(t, a);
    }
    expect(t.treasury).toBeGreaterThanOrEqual(Math.min(s.treasury, s.automation.reserve));
  });

  it('traces a short round to an export ban at its supplier', () => {
    const s = start(10);
    // Starve PAC-3 and ban every foreign supplier.
    s.sites.depotCentral.lots.pac3 = [];
    for (const id of Object.keys(s.sites)) if (id === 'sableCircuits' || id === 'lyreSensors' || id === 'karskMetals' || id === 'brightwater' || id === 'northwind') s.sites[id].embargoDays = 200;
    const d = diagnose(s).find((x) => x.line === 'pac3');
    expect(d).toBeDefined();
    expect(d!.cause.length).toBeGreaterThan(10);
  });
});

describe('review fixes', () => {
  it('the weekly round never takes the treasury below the reserve, even for costly refurbishing', () => {
    const s = start(11, ['logistics']);
    s.sites.depotCentral.unserviceable.pac3 = 300;
    s.sites.depotCentral.unserviceable.sm6 = 300;
    s.automation.reserve = s.treasury - 60;
    const t = advanceDays(s, 8);
    expect(t.treasury).toBeGreaterThanOrEqual(Math.min(s.automation.reserve, s.treasury) - 120);
  });

  it('does not buy an ally’s rounds it cannot afford', () => {
    const s = start(12);
    s.treasury = 650;
    s.automation.reserve = 300;
    const d = { id: 1, kind: 'allyOffer', title: '', body: '', fallback: 'pass', options: [{ id: 'buy', label: '', detail: '' }, { id: 'pass', label: '', detail: '' }], data: { ally: 'merrow', line: 'pac3', qty: 120, price: 5.3 } } as never;
    expect(recommend(s, d).option).toBe('pass');
  });

  it('stays out of the tutorial, and the log never shows raw action names', () => {
    const tu = openCampaign(newSim({ seed: 2, scenario: 'tutorial' }));
    expect(validate(tu, { type: 'automate', area: 'staffing', on: true })).toMatch(/tutorial/);
    const s = advanceDays(start(13, PRESETS.full), 300);
    for (const l of s.automation.log) expect(l.text).not.toMatch(/^[a-z]+[A-Z][a-zA-Z]*$|^[a-z]+$/);
  });
});
