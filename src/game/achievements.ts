// Achievements: earned across campaigns and remembered in this browser.
import { termReport } from '../sim/analytics';
import type { SimState } from '../sim/types';

export interface AchievementDef {
  id: string;
  title: string;
  text: string;
  check: (s: SimState) => boolean;
}

const leaks = (h: SimState['history'][number]) => Object.values(h.leaked).reduce((a, b) => a + b, 0);

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'tender', title: 'Best and final', text: 'Award a contract through a tender.', check: (s) => s.feed.some((f) => f.text.startsWith('Contract awarded')) },
  { id: 'source', title: 'Belt and braces', text: 'Qualify a second source.', check: (s) => s.feed.some((f) => f.text.includes('is qualified to supply')) },
  { id: 'racks', title: 'Full racks', text: 'End a month at 95% readiness or better.', check: (s) => (s.history.at(-1)?.readiness ?? 0) >= 0.95 && s.history.length > 12 },
  { id: 'clean', title: 'Clean sky', text: 'A whole month with nothing getting through.', check: (s) => s.history.some((h) => leaks(h) < 0.5) },
  { id: 'crisis', title: 'Held the line', text: 'See a crisis through with readiness at 70% or better.', check: (s) => s.feed.some((f) => f.text.includes('has wound down')) && (s.history.at(-1)?.readiness ?? 0) >= 0.7 },
  { id: 'export', title: 'Open for business', text: 'Export 100 rounds.', check: (s) => s.history.reduce((a, h) => a + (h.exported ?? 0), 0) >= 100 },
  { id: 'ally', title: 'Old friends', text: 'Raise relations with an ally to 80.', check: (s) => Object.values(s.allies).some((v) => v >= 80) },
  { id: 'lab', title: 'Skunk works', text: 'Finish eight research projects.', check: (s) => s.strategy.research.done.length >= 8 },
  { id: 'team', title: 'The right people', text: 'Fill every key staff post.', check: (s) => Object.values(s.strategy.staff).every(Boolean) },
  { id: 'term', title: 'Served the term', text: 'Complete a campaign.', check: (s) => s.outcome === 'complete' },
  { id: 'gradeA', title: 'With distinction', text: 'Finish a campaign with an A.', check: (s) => s.outcome === 'complete' && termReport(s).grade === 'A' },
  { id: 'hard', title: 'Iron director', text: 'Complete a campaign on Hard.', check: (s) => s.outcome === 'complete' && s.difficulty === 'hard' },
  { id: 'war', title: 'Trial by fire', text: 'Complete the War footing scenario.', check: (s) => s.outcome === 'complete' && s.scenario === 'warFooting' },
  { id: 'sanctions', title: 'Self-reliance', text: 'Complete the Sanctions scenario.', check: (s) => s.outcome === 'complete' && s.scenario === 'sanctions' },
  { id: 'tutorial', title: 'Quick study', text: 'Finish the tutorial.', check: (s) => s.scenario === 'tutorial' && (s.tutorial?.step ?? 0) >= 99 },
];

const KEY = 'forge-command-achievements';

export function loadAchievements(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {};
  } catch {
    return {};
  }
}

/** Records any newly earned achievements and returns them. */
export function checkAchievements(s: SimState): AchievementDef[] {
  // Achievements are earned in campaigns, not in the sandbox.
  if (s.mode === 'sandbox') return [];
  const have = loadAchievements();
  const fresh = ACHIEVEMENTS.filter((a) => !have[a.id] && a.check(s));
  if (!fresh.length) return [];
  for (const a of fresh) have[a.id] = new Date().toISOString().slice(0, 10);
  try {
    localStorage.setItem(KEY, JSON.stringify(have));
  } catch {
    /* storage may be unavailable */
  }
  return fresh;
}
