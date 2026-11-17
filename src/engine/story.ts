// Story: each scenario has a briefing, chapter beats from your deputy, and objectives with deadlines.
import { BASE_BAYS_PER_LINE, CAMPUSES, CAMPUS_IDS, FACILITY_IDS, LINES, LINE_IDS, STAFF_ROLE_IDS, SUPPLIERS, SUPPLIER_IDS, linesAt } from './data';
import { clamp } from './rng';
import { readiness } from './selectors';
import type { GameState, MonthReport, ScenarioId } from './types';

type Messages = MonthReport['messages'];

export const DEPUTY = 'Deputy Director Ilse Marsk';

export interface ObjectiveDef {
  id: string;
  title: string;
  text: string;
  /** Last month (0-based) by which it must be done. */
  deadline: number;
  check: (s: GameState) => boolean;
  reward: { confidence?: number; money?: number };
  rewardText: string;
}

const secondSource = (s: GameState) => SUPPLIER_IDS.some((sid) => !SUPPLIERS[sid].startQualified && s.suppliers[sid].qualified);
const expansionsTotal = (s: GameState) => LINE_IDS.reduce((a, id) => a + s.lines[id].tranches.filter((t) => !t.base).length, 0);
const startBays = (c: (typeof CAMPUS_IDS)[number]) => linesAt(c).filter((id) => !LINES[id].research).length * BASE_BAYS_PER_LINE + CAMPUSES[c].spareBays;
const anyBuilding = (s: GameState) => CAMPUS_IDS.some((c) => s.campuses[c].bays > startBays(c));
const plantRunning = (s: GameState) => FACILITY_IDS.some((f) => s.facilities[f].status === 'running');
const counterDrone = (s: GameState) => s.lines.apkws.tranches.length > 0 || s.lines.coyote.tranches.length > 0;

export const STORY: Record<ScenarioId, { briefing: string; beats: { month: number; text: string }[]; objectives: ObjectiveDef[] }> = {
  standard: {
    briefing:
      'Director, welcome. The country is at peace, for now, and the Committee has given you a quiet first season to put the Board in order. Our racks hold about half of what doctrine asks for. Our suppliers are thin. I would use the calm.',
    beats: [
      { month: 6, text: `${DEPUTY}: "Half a year in. The Vardan Directorate keeps building. So should we."` },
      { month: 12, text: `${DEPUTY}: "First year done. The Committee is watching how we handle the first real storm."` },
      { month: 24, text: `${DEPUTY}: "Two years. Whatever we did not fix in calm times, we will fix under fire."` },
      { month: 36, text: `${DEPUTY}: "One year left on your term. Let us leave the next Director something to be proud of."` },
    ],
    objectives: [
      { id: 'std-source', title: 'A second source', text: 'Qualify any second-source supplier.', deadline: 11, check: secondSource, reward: { confidence: 5 }, rewardText: '+5 confidence' },
      { id: 'std-ready', title: 'Six months deep', text: 'Reach 80% readiness.', deadline: 17, check: (s) => readiness(s) >= 0.8, reward: { money: 150 }, rewardText: '$150M bonus allocation' },
      { id: 'std-drone', title: 'Cheap shots', text: 'Set up an APKWS or Coyote line.', deadline: 29, check: counterDrone, reward: { confidence: 6 }, rewardText: '+6 confidence' },
      { id: 'std-trust', title: 'Trusted', text: 'Hold confidence at 65 or more at the end of year three.', deadline: 35, check: (s) => s.month >= 35 && s.confidence >= 65, reward: { money: 200 }, rewardText: '$200M bonus allocation' },
    ],
  },
  longWar: {
    briefing:
      'Director, there is no time for a welcome. The Halvard Strait air campaign is already burning through our interceptors. Keep the Halvard Coast supplied, and get the factories surging. The Committee wants results, not plans.',
    beats: [
      { month: 3, text: `${DEPUTY}: "The coast is holding, just. We need more floor space before the next wave."` },
      { month: 12, text: `${DEPUTY}: "A year of war. The workers are tired. Watch morale."` },
      { month: 24, text: `${DEPUTY}: "This is a long war now. Build for the long haul: plants, sources, people."` },
    ],
    objectives: [
      { id: 'lw-hold', title: 'Hold the line', text: 'Keep the Committee’s confidence above 30 through the first year.', deadline: 11, check: (s) => s.month >= 11 && s.confidence > 30, reward: { money: 150 }, rewardText: '$150M war supplemental' },
      { id: 'lw-scale', title: 'Scale up', text: 'Add three expansion bays across your lines.', deadline: 14, check: (s) => expansionsTotal(s) >= 3, reward: { confidence: 5 }, rewardText: '+5 confidence' },
      { id: 'lw-coast', title: 'Strait secure', text: 'Reach 70% readiness with a Halvard Coast depot target of 2 months or more.', deadline: 23, check: (s) => readiness(s) >= 0.7 && s.theaters.coast.targetMonths >= 2, reward: { confidence: 6 }, rewardText: '+6 confidence' },
      { id: 'lw-arsenal', title: 'Arsenal of the Commonwealth', text: 'Run an in-house plant.', deadline: 35, check: plantRunning, reward: { money: 250 }, rewardText: '$250M bonus allocation' },
    ],
  },
  brokenChain: {
    briefing:
      'Director, the Karsk Federation has stopped all gallium and germanium exports, and Sable Circuit Works is struggling. Every radar seeker we build depends on both. Find new sources, redesign what we can, and stretch what we have.',
    beats: [
      { month: 4, text: `${DEPUTY}: "Our gallium stockpile will not last. Substitutes buy time, not victory."` },
      { month: 12, text: `${DEPUTY}: "The embargo may lift, or not. Either way, we never depend on one country again."` },
      { month: 24, text: `${DEPUTY}: "Supply chains are strategy. The Committee is finally listening."` },
    ],
    objectives: [
      { id: 'bc-gallium', title: 'New gallium', text: 'Qualify Greenhollow Recovery or Corvane Minerals.', deadline: 11, check: (s) => s.suppliers.greenhollow.qualified || s.suppliers.corvaneminerals.qualified, reward: { confidence: 6 }, rewardText: '+6 confidence' },
      { id: 'bc-chips', title: 'Trusted chips', text: 'Qualify Aldmere Trusted Foundry.', deadline: 19, check: (s) => s.suppliers.trusted.qualified, reward: { money: 120 }, rewardText: '$120M bonus allocation' },
      { id: 'bc-design', title: 'Design around it', text: 'Complete the Gallium-light RF modules research.', deadline: 23, check: (s) => s.research.done.includes('galliumLight'), reward: { confidence: 5 }, rewardText: '+5 confidence' },
      { id: 'bc-back', title: 'Back on track', text: 'Reach 75% readiness.', deadline: 35, check: (s) => readiness(s) >= 0.75, reward: { money: 200 }, rewardText: '$200M bonus allocation' },
    ],
  },
  rebuild: {
    briefing:
      'Director, the racks are nearly empty. Years of cuts saw to that. The good news: the Committee is finally spending. The bad news: everyone will be watching how. Rebuild the reserve, and build the Board that keeps it full.',
    beats: [
      { month: 6, text: `${DEPUTY}: "The money is flowing. Make sure it turns into rounds, not reports."` },
      { month: 12, text: `${DEPUTY}: "A year in, and the racks are filling. The quiet will not last forever."` },
      { month: 24, text: `${DEPUTY}: "Now we find out whether we rebuilt well, or just quickly."` },
    ],
    objectives: [
      { id: 'rb-team', title: 'Build the team', text: 'Fill all five key staff posts.', deadline: 11, check: (s) => STAFF_ROLE_IDS.every((r) => s.staff[r]), reward: { confidence: 4 }, rewardText: '+4 confidence' },
      { id: 'rb-refill', title: 'Refill the racks', text: 'Reach 60% readiness.', deadline: 11, check: (s) => readiness(s) >= 0.6, reward: { money: 120 }, rewardText: '$120M bonus allocation' },
      { id: 'rb-floor', title: 'Grow the floor', text: 'Open a new building on any campus.', deadline: 17, check: anyBuilding, reward: { confidence: 5 }, rewardText: '+5 confidence' },
      { id: 'rb-full', title: 'Full house', text: 'Reach 90% readiness.', deadline: 29, check: (s) => readiness(s) >= 0.9, reward: { money: 250 }, rewardText: '$250M bonus allocation' },
    ],
  },
};

export const objectiveDef = (s: GameState, id: string) => STORY[s.scenario].objectives.find((o) => o.id === id);

/** Checks objectives and plays chapter beats. Call once a month, after the turn resolves. */
export function runStory(s: GameState, messages: Messages): void {
  for (const beat of STORY[s.scenario].beats) if (beat.month === s.month) messages.push({ tone: 'info', text: beat.text });
  for (const o of s.objectives) {
    if (o.status !== 'open') continue;
    const def = objectiveDef(s, o.id);
    if (!def) continue;
    if (def.check(s)) {
      o.status = 'done';
      if (def.reward.confidence) s.confidence = clamp(s.confidence + def.reward.confidence);
      if (def.reward.money) {
        s.treasury += def.reward.money;
        s.pending.revenue += def.reward.money;
      }
      messages.push({ tone: 'good', text: `Objective complete: ${def.title}. ${def.rewardText}.` });
    } else if (s.month >= def.deadline) {
      o.status = 'failed';
      s.confidence = clamp(s.confidence - 3);
      messages.push({ tone: 'bad', text: `Objective missed: ${def.title}. The Committee notices.` });
    }
  }
}
