import { describe, expect, it } from 'vitest';
import {
  STAFF_ROLE_IDS,
  applyAction,
  contractPrice,
  endTurn,
  newGame,
  playTurn,
  researchMonths,
  validateAction,
  type Action,
  type GameState,
} from '../src/engine';

const resolveAll = (s: GameState): Action[] => s.decisions.map((d) => ({ type: 'resolveDecision', decision: d.id, option: d.fallback }) as Action);
const rich = (s: GameState): GameState => ({ ...s, treasury: 5000 });

describe('key staff', () => {
  it('a new campaign offers two candidates for every post, all posts vacant', () => {
    const s = newGame({ seed: 1 });
    for (const role of STAFF_ROLE_IDS) {
      expect(s.staff[role]).toBeNull();
      expect(s.candidates.filter((c) => c.role === role)).toHaveLength(2);
    }
  });

  it('hiring a chief of procurement makes contracts cheaper; firing costs severance', () => {
    let s = rich(newGame({ seed: 2 }));
    const before = contractPrice(s, 'kestrel', 24);
    const pick = s.candidates.find((c) => c.role === 'procurement')!;
    s = applyAction(s, { type: 'hireStaff', candidate: pick.id });
    expect(s.staff.procurement?.name).toBe(pick.name);
    expect(contractPrice(s, 'kestrel', 24)).toBeLessThan(before);
    const t = s.treasury;
    s = applyAction(s, { type: 'fireStaff', role: 'procurement' });
    expect(s.staff.procurement).toBeNull();
    expect(s.treasury).toBeLessThan(t);
    expect(validateAction(s, { type: 'fireStaff', role: 'procurement' })).toMatch(/Nobody/);
  });

  it('a chief engineer speeds up research', () => {
    let s = rich(newGame({ seed: 3 }));
    const slow = researchMonths(s, 'commonMotors');
    const eng = s.candidates.filter((c) => c.role === 'research').sort((a, b) => b.skill - a.skill)[0];
    s = applyAction(s, { type: 'hireStaff', candidate: eng.id });
    expect(researchMonths(s, 'commonMotors')).toBeLessThan(slow);
  });

  it('salaries show up in the wage bill', () => {
    const base = newGame({ seed: 4 });
    const hired = applyAction(rich(base), { type: 'hireStaff', candidate: base.candidates[0].id });
    expect(endTurn(hired).history[0].ledger.wages).toBeGreaterThan(endTurn(base).history[0].ledger.wages);
  });
});

describe('politics', () => {
  it('factions react: overspending angers the treasury bench', () => {
    const s = structuredClone(newGame({ seed: 5 }));
    s.treasury = -800;
    const after = endTurn(s);
    expect(after.factions.treasury).toBeLessThan(s.factions.treasury);
  });

  it('an open export policy brings more tenders and pleases the alliance group', () => {
    let open = applyAction(newGame({ seed: 6 }), { type: 'setExportPolicy', policy: 'open' });
    let shut = applyAction(newGame({ seed: 6 }), { type: 'setExportPolicy', policy: 'restrictive' });
    let tendersOpen = 0;
    let tendersShut = 0;
    for (let i = 0; i < 24; i++) {
      open = playTurn(open, resolveAll(open));
      shut = playTurn(shut, resolveAll(shut));
      tendersOpen += open.history.at(-1)!.messages.filter((m) => m.text.startsWith('Tender:')).length;
      tendersShut += shut.history.at(-1)!.messages.filter((m) => m.text.startsWith('Tender:')).length;
    }
    expect(tendersOpen).toBeGreaterThan(tendersShut);
    expect(open.factions.internationalists).toBeGreaterThan(shut.factions.internationalists);
  });

  it('every fiscal year ends with a budget request card', () => {
    let s = newGame({ seed: 7, difficulty: 'easy' });
    for (let i = 0; i < 12; i++) s = playTurn(s, resolveAll(s));
    const card = s.decisions.find((d) => d.kind === 'budgetRequest');
    expect(card).toBeDefined();
    const before = s.appropriation;
    s = applyAction(s, { type: 'resolveDecision', decision: card!.id, option: 'lean' });
    expect(s.appropriation).toBe(Math.round(before * 0.95));
  });
});
