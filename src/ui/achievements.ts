// Achievements: unlocked across campaigns, kept in this browser.
import { FACILITY_IDS, STAFF_ROLE_IDS, costExchange, debrief, readiness, type GameState } from '../engine';

export interface Achievement {
  id: string;
  name: string;
  text: string;
  check: (s: GameState) => boolean;
}

const leakedLast = (s: GameState) => {
  const h = s.history.at(-1);
  return h ? Object.values(h.threats).reduce((a, t) => a + t.leaked, 0) : Infinity;
};

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-month', name: 'Open for business', text: 'End your first month.', check: (s) => s.history.length >= 1 },
  { id: 'first-year', name: 'Fiscal survivor', text: 'Survive a fiscal-year review.', check: (s) => s.reviews.length >= 1 },
  { id: 'full-racks', name: 'Full racks', text: 'Reach 100% readiness.', check: (s) => readiness(s) >= 0.999 },
  { id: 'iron-dome', name: 'Nothing gets through', text: 'A crisis month with no leakers at all.', check: (s) => s.crisis?.phase === 'active' && leakedLast(s) < 0.5 },
  { id: 'cost-win', name: 'Winning the exchange', text: 'Stop more threat value than you fire, over a whole campaign of at least a year.', check: (s) => s.history.length >= 12 && debrief(s).totals.stopped$ > debrief(s).totals.spend },
  { id: 'cheap-shots', name: 'Cheap shots', text: 'Fire 500 APKWS in one campaign.', check: (s) => s.reserves.apkws.used >= 500 },
  { id: 'self-reliant', name: 'Self-reliant', text: 'Run all three in-house plants at once.', check: (s) => FACILITY_IDS.every((f) => s.facilities[f].status === 'running') },
  { id: 'full-staff', name: 'Dream team', text: 'Fill every key staff post with skill-3 people.', check: (s) => STAFF_ROLE_IDS.every((r) => (s.staff[r]?.skill ?? 0) >= 3) },
  { id: 'research-all', name: 'Engineering marvel', text: 'Complete every research project.', check: (s) => s.research.done.length >= 14 },
  { id: 'no-debt', name: 'Balanced books', text: 'Finish a campaign without ever going over budget.', check: (s) => s.over && s.outcome === 'complete' && s.history.every((h) => h.treasury >= 0) },
  { id: 'beloved', name: 'Committee darling', text: 'Reach 100 confidence.', check: (s) => s.confidence >= 99.5 },
  { id: 'allies', name: 'Arsenal of friends', text: 'Get every partner nation’s goodwill to 80.', check: (s) => Object.values(s.partners).every((p) => p.goodwill >= 80) },
  { id: 'objectives', name: 'Mission accomplished', text: 'Complete every objective in a scenario.', check: (s) => s.objectives.length > 0 && s.objectives.every((o) => o.status === 'done') },
  { id: 'hard-win', name: 'Hard as forged steel', text: 'Complete a campaign on Hard.', check: (s) => s.over && s.outcome === 'complete' && s.difficulty === 'hard' },
  { id: 'ironman', name: 'Ironman', text: 'Complete a campaign in ironman mode.', check: (s) => s.over && s.outcome === 'complete' && s.modifiers.includes('ironman') },
  { id: 'deterrence', name: 'Deterrence works', text: 'End a campaign with the rival weaker than it started.', check: (s) => s.over && s.rival < 100 },
  { id: 'exchange-apkws', name: 'Rocket economics', text: 'APKWS ends a campaign with a cost exchange above 1.', check: (s) => s.over && (costExchange(s).find((r) => r.line === 'apkws')?.ratio ?? 0) > 1 },
];

const KEY = 'forge-command-achievements-v1';

export function loadAchievements(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}

/** Checks the state and stores anything new. Returns newly unlocked achievements. */
export function checkAchievements(s: GameState): Achievement[] {
  if (s.custom) return []; // sandbox games do not count
  const got = loadAchievements();
  const fresh = ACHIEVEMENTS.filter((a) => !got[a.id] && a.check(s));
  if (fresh.length) {
    const date = new Date().toISOString().slice(0, 10);
    for (const a of fresh) got[a.id] = date;
    try {
      localStorage.setItem(KEY, JSON.stringify(got));
    } catch {
      /* ignore */
    }
  }
  return fresh;
}
