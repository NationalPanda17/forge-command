// Industrial espionage: the rival's intelligence service targets your plants. Vetting raises security; low morale
// lowers it. Incidents are sabotage, stolen designs or leaks, unless your people catch the ring first.
import { clamp, pick, rand, randInt } from './rng';
import type { FeedItem, SimState } from './types';
import { SITES, SITE_BY_ID } from './world';
import { RIVAL_NAME } from './rival';

type Feed = (s: SimState, tone: FeedItem['tone'], text: string, site?: string, alert?: boolean) => void;

export const MAX_CLEARANCE = 3;
export const CLEARANCE_NAME = ['None', 'Basic checks', 'Enhanced vetting', 'Full clearance'] as const;

/** Plants worth spying on: your arsenals, founded plants and component lines. */
export const targets = (s: SimState) => SITES.filter((d) => d.owner === 'state' && s.sites[d.id].processes.length > 0 && s.sites[d.id].status !== 'closed' && !s.sites[d.id].mothballed).map((d) => d.id);

/** 0..1: how hard a site is to penetrate. Clearance does most of it; unhappy crews leak. */
export function security(s: SimState, id: string): number {
  const site = s.sites[id];
  const vet = (site.clearance ?? 0) / MAX_CLEARANCE;
  const morale = (site.morale ?? 65) / 100;
  return clamp(0.15 + 0.6 * vet + 0.25 * (morale - 0.4), 0, 0.95);
}

/** How active the rival's intelligence service is: it grows with every weapon the rival is working on. */
export const activity = (s: SimState) => 0.012 * (1 + (s.rival?.known.length ?? 0)) * (s.settings?.events ?? 1);

export const vetCost = (s: SimState, id: string) => Math.round((6 + SITE_BY_ID[id].crew * 0.012 + (s.sites[id].extraCrew ?? 0) * 0.012) * ((s.sites[id].clearance ?? 0) + 1) * s.priceIndex);

export function securityMonth(s: SimState, feed: Feed): void {
  if (s.scenario === 'tutorial' && s.day < 360) return;
  for (const id of targets(s)) {
    const p = activity(s) * (1 - security(s, id));
    if (rand(s) >= p) continue;
    const name = SITE_BY_ID[id].name;
    const kind = pick(s, ['sabotage', 'sabotage', 'theft', 'leak'] as const);
    const site = s.sites[id];
    // Good security catches a ring before it does harm.
    if (rand(s) < 0.15 + 0.25 * (site.clearance ?? 0)) {
      s.strategy.decisions.push({
        id: s.nextId++,
        kind: 'spyRing',
        title: `Spy ring uncovered at ${name}`,
        body: `Security officers at ${name} have caught a small ring working for ${RIVAL_NAME} before it could act. What now?`,
        options: [
          { id: 'expose', label: 'Expose it publicly', detail: 'The Committee is impressed; the rival is embarrassed.' },
          { id: 'turn', label: 'Turn them into double agents', detail: 'Feed them false papers: your next warning of a new weapon comes much earlier.' },
          { id: 'quiet', label: 'Dismiss them quietly', detail: 'No fuss, and no gain.' },
        ],
        fallback: 'quiet',
        site: id,
      });
      feed(s, 'good', `A spy ring is uncovered at ${name}. A decision is waiting.`, id, true);
      continue;
    }
    s.month.incidents = (s.month.incidents ?? 0) + 1;
    if (kind === 'sabotage') {
      site.disruptionDays = Math.max(site.disruptionDays, randInt(s, 20, 45));
      site.disruptionFactor = Math.min(site.disruptionFactor, 0.4);
      site.condition = clamp(site.condition - 10);
      feed(s, 'bad', `Sabotage at ${name}: a fire in the assembly hall. Output down to 40% for weeks.`, id, true);
    } else if (kind === 'theft') {
      // Stolen designs speed up the rival's next weapon.
      if (s.rival) s.rival.next = Math.max(s.day + 5, s.rival.next - 75);
      s.confidence = clamp(s.confidence - 2);
      feed(s, 'bad', `Designs stolen from ${name}. Intel expects ${RIVAL_NAME} to move faster now.`, id, true);
    } else {
      s.confidence = clamp(s.confidence - 3);
      s.strategy.factions.hawks = clamp(s.strategy.factions.hawks - 3);
      if (s.crisis) s.crisis.intensity = Math.round((s.crisis.intensity + 0.15) * 100) / 100;
      feed(s, 'bad', `Stock figures leaked from ${name}. The rival now knows where you are thin, and the Committee is angry.`, id, true);
    }
  }
}

/** Handles the spy-ring decision. */
export function resolveSecurity(s: SimState, d: { kind: string; site?: string }, opt: string, feed: Feed): boolean {
  if (d.kind !== 'spyRing') return false;
  if (opt === 'expose') {
    s.confidence = clamp(s.confidence + 3);
    s.strategy.factions.hawks = clamp(s.strategy.factions.hawks + 2);
    feed(s, 'good', 'The spy ring is exposed in the press. The Committee is pleased.');
  } else if (opt === 'turn') {
    // Double agents: the next weapon is reported much sooner, so there is longer to prepare.
    const k = s.rival?.known.find((x) => x.fielded > s.day);
    if (k) k.fielded += 60;
    else if (s.rival) s.rival.next = Math.max(s.day + 30, s.rival.next + 45);
    feed(s, 'good', 'The ring is turned. Its reports now buy you time against the rival.');
  } else feed(s, 'info', 'The spy ring is quietly dismissed.');
  return true;
}

