// The factory floor: each line is a chain of stages with buffers between them, acceptance draws on
// campus test cells, and in-house plants feed the shared component stock.
import {
  CAMPUSES,
  CAMPUS_IDS,
  COMPONENTS,
  COMPONENT_IDS,
  DEBOTTLENECK_STEP,
  DIFFICULTY,
  FACILITIES,
  FACILITY_IDS,
  LINES,
  LINE_IDS,
  MIN_SAFE_TEST_SHARE,
  RUN_FACTOR,
  STAGES,
  TEST_CELL_HOURS,
  WIP_MONTHS,
} from './data';
import { deliverToPartners } from './partners';
import { qualityMult } from './politics';
import { clamp, rand, randRange } from './rng';
import { bomOf, campusCrewNeed, effectiveCapacity, hasResearch, productivity, staffing, strikeFactor, testHoursMult } from './selectors';
import type { ComponentId, FacilityId, FacilityState, GameState, LineId, MonthReport, Priority, StageLast } from './types';

type Messages = MonthReport['messages'];
const PRIORITY_ORDER: Priority[] = ['high', 'normal', 'low'];
const round2 = (v: number) => Math.round(v * 100) / 100;
const fmt = (v: number) => Math.round(v).toLocaleString('en-US');

/** Share of the learning curve achieved, 0..1. */
const learnFrac = (s: GameState, id: LineId) => (productivity(s.lines[id]) - 1) / 0.3;

/** Stage yield after learning: experience removes up to 40% of the scrap. */
export function stageYield(s: GameState, id: LineId, i: number): number {
  const y = STAGES[id][i].yield;
  return 1 - (1 - y) * (1 - 0.4 * learnFrac(s, id)) * (hasResearch(s, 'yieldAnalytics') ? 0.7 : 1);
}

/** Units each stage can process this month, before parts, buffers and test cells. */
export function stageCaps(s: GameState, id: LineId): number[] {
  const line = s.lines[id];
  const campus = LINES[id].campus;
  const base = effectiveCapacity(line) * RUN_FACTOR[line.run] * staffing(s, campus) * strikeFactor(s, campus);
  const lean = hasResearch(s, 'leanAssembly') ? 1.15 : 1;
  return STAGES[id].map((st, i) => base * st.mult * (st.id === 'assembly' ? lean : 1) * (1 + DEBOTTLENECK_STEP * (line.debottleneck[i] ?? 0)));
}

/** Units each buffer can hold. */
export const bufferMax = (s: GameState, id: LineId) => effectiveCapacity(s.lines[id]) * WIP_MONTHS + 1;

/** Test-cell hours a line would need at its planned rate. */
export function testHoursNeed(s: GameState, id: LineId): number {
  const stages = STAGES[id];
  const last = stages[stages.length - 1];
  const caps = stageCaps(s, id);
  return (last.testHours ?? 0) * testHoursMult(s) * Math.min(caps[caps.length - 2] ?? caps[0], caps[caps.length - 1]);
}

export const campusTestHours = (s: GameState, campus: (typeof CAMPUS_IDS)[number]) => s.campuses[campus].testCells * TEST_CELL_HOURS;

export function facilityCap(s: GameState, f: FacilityId): number {
  const st = s.facilities[f];
  if (st.status !== 'running' || st.run === 'idle') return 0;
  return st.tranches.reduce((a, t) => a + (t.faiMonths > 0 ? 0 : t.capacity * t.maturity), 0);
}

export const facilityCrew = (s: GameState, f: FacilityId) => {
  const st = s.facilities[f];
  if (st.status !== 'running') return 0;
  const installed = st.tranches.reduce((a, t) => a + t.capacity, 0);
  return FACILITIES[f].crew * (installed / FACILITIES[f].baseCap) * (st.run === 'idle' ? 0.15 : 1);
};

/** In-house plants: build progress, then production into the shared stock. Returns $M spent. */
export function runFacilities(s: GameState, messages: Messages): { materials: number; overhead: number } {
  const rules = DIFFICULTY[s.difficulty];
  let materials = 0;
  let overhead = 0;
  for (const f of FACILITY_IDS) {
    const def = FACILITIES[f];
    const st = s.facilities[f];
    if (st.status === 'building') {
      st.monthsLeft--;
      if (st.monthsLeft <= 0) {
        st.status = 'running';
        messages.push({ tone: 'good', text: `${def.name} is complete. First articles are under inspection.` });
      }
      continue;
    }
    if (st.status !== 'running') continue;
    overhead += def.overhead * (st.run === 'idle' ? 0.3 : 1);
    const staff = staffing(s, def.campus) * strikeFactor(s, def.campus);
    let want = facilityCap(s, f) * staff;
    let limit: FacilityState['lastLimit'] = st.run === 'idle' ? 'idle' : staff < 0.98 ? 'crew' : 'capacity';
    for (const [c, q] of Object.entries(def.inputs) as [ComponentId, number][]) {
      const cs = s.components[c];
      if (!rules.shortages && cs.stock < want * q) {
        // Easy: suppliers always keep up, at list price.
        materials += (want * q - cs.stock) * COMPONENTS[c].price;
        cs.stock = want * q;
      }
      const can = cs.stock / q;
      if (can < want) {
        want = can;
        limit = c;
      }
    }
    want = Math.max(0, want);
    for (const [c, q] of Object.entries(def.inputs) as [ComponentId, number][]) {
      s.components[c].stock = Math.max(0, s.components[c].stock - want * q);
      s.components[c].lastUsed += want * q;
    }
    s.components[def.component].stock += want;
    s.components[def.component].lastDelivered = round2(s.components[def.component].lastDelivered + want);
    materials += want * def.unitCost;
    st.lastOutput = round2(want);
    st.lastLimit = limit;
    for (const t of st.tranches) {
      if (t.faiMonths > 0) {
        t.faiMonths--;
        if (t.faiMonths === 0) messages.push({ tone: 'good', text: `First articles pass at ${def.name}.` });
      } else t.maturity = Math.min(1, round2(t.maturity + rules.rampPerMonth));
    }
  }
  return { materials, overhead };
}

export interface FactoryResult {
  output: Record<LineId, number>;
  componentSpend: number;
  revenue: number;
}

export function runFactory(s: GameState, messages: Messages): FactoryResult {
  const rules = DIFFICULTY[s.difficulty];
  const output = Object.fromEntries(LINE_IDS.map((id) => [id, 0])) as Record<LineId, number>;
  let componentSpend = 0;
  let revenue = 0;
  const subLeft = Object.fromEntries(COMPONENT_IDS.map((c) => [c, COMPONENTS[c].substitute.cap])) as Record<ComponentId, number>;
  const staffed = Object.fromEntries(CAMPUS_IDS.map((c) => [c, staffing(s, c)]));
  const hoursLeft = Object.fromEntries(CAMPUS_IDS.map((c) => [c, campusTestHours(s, c)])) as Record<string, number>;
  for (const c of CAMPUS_IDS) {
    s.campuses[c].lastCrewNeed = campusCrewNeed(s, c);
    s.campuses[c].lastTestHours = { need: 0, avail: hoursLeft[c] };
  }

  for (const prio of PRIORITY_ORDER) {
    const ids = LINE_IDS.filter((id) => s.lines[id].priority === prio && s.lines[id].run !== 'idle' && s.lines[id].tranches.length > 0);

    // Plan pass: how much each stage would process, to size this group's parts demand.
    const caps = {} as Record<LineId, number[]>;
    const planned = {} as Record<LineId, number[]>;
    for (const id of ids) {
      caps[id] = stageCaps(s, id);
      const wip = s.lines[id].wip;
      const p: number[] = [];
      for (let i = 0; i < caps[id].length; i++) p.push(i === 0 ? caps[id][0] : Math.min(caps[id][i], wip[i - 1] + p[i - 1]));
      planned[id] = p;
    }
    const ratio = {} as Record<ComponentId, number>;
    for (const c of COMPONENT_IDS) {
      let need = 0;
      for (const id of ids) {
        STAGES[id].forEach((st, i) => {
          if (st.comps.includes(c)) need += planned[id][i] * (bomOf(s, id)[c] ?? 0);
        });
      }
      const cs = s.components[c];
      if (need > cs.stock && !rules.shortages) {
        // Easy: suppliers always keep up, at list price.
        componentSpend += (need - cs.stock) * COMPONENTS[c].price;
        cs.lastDelivered = round2(cs.lastDelivered + need - cs.stock);
        cs.stock = need;
      }
      ratio[c] = need > 0 ? Math.min(1, cs.stock / need) : 1;
    }

    for (const id of ids) {
      const line = s.lines[id];
      const def = { ...LINES[id], bom: bomOf(s, id) };
      const stages = STAGES[id];
      const testMult = testHoursMult(s);
      const campus = def.campus;
      const bufMax = bufferMax(s, id);
      const stageLast: StageLast[] = [];
      let partsLimit: ComponentId | null = null;
      let testsLimited = false;
      let degradedFrac = 0;
      const used: ComponentId[] = [];
      let good = 0;

      for (let i = 0; i < stages.length; i++) {
        const st = stages[i];
        const cap = caps[id][i];
        let lim = cap;
        let why: StageLast['limit'] = 'capacity';
        if (i > 0 && line.wip[i - 1] < lim) {
          lim = line.wip[i - 1];
          why = 'starved';
        }
        if (i < stages.length - 1) {
          const room = Math.max(0, bufMax - line.wip[i]) + caps[id][i + 1];
          if (room < lim) {
            lim = room;
            why = 'blocked';
          }
        }
        if (st.testHours) {
          const canTest = hoursLeft[campus] / (st.testHours * testMult);
          s.campuses[campus].lastTestHours.need += lim * st.testHours * testMult;
          if (canTest < lim) {
            lim = canTest;
            why = 'tests';
            testsLimited = true;
          }
        }
        // Parts: limited by this group's share of each component, topped up by substitutes if allowed.
        let frac = 1;
        const primF: Partial<Record<ComponentId, number>> = {};
        for (const c of st.comps) {
          const q = def.bom[c] ?? 0;
          if (q <= 0) continue;
          const allowed = planned[id][i] * ratio[c];
          let f = lim > 0 ? Math.min(1, allowed / lim) : 1;
          primF[c] = f;
          if (f < 1 && line.substitutes[c]) f += Math.min(1 - f, lim > 0 ? subLeft[c] / (lim * q) : 0);
          if (f < frac) {
            frac = f;
            partsLimit = c;
          }
        }
        if (frac < 0.999) why = 'parts';
        const through = Math.max(0, lim * frac);
        for (const c of st.comps) {
          const q = def.bom[c] ?? 0;
          if (q <= 0) continue;
          const cs = s.components[c];
          const primaryFrac = Math.min(frac, primF[c] ?? 1);
          const subFrac = frac - primaryFrac;
          const prim = lim * primaryFrac * q;
          const sub = lim * subFrac * q;
          cs.stock = Math.max(0, cs.stock - prim);
          cs.lastUsed += prim;
          if (why === 'parts') cs.lastShort += (lim - through) * q;
          if (sub > 0.0001) {
            subLeft[c] -= sub;
            cs.lastSubstituted += sub;
            componentSpend += sub * COMPONENTS[c].price * COMPONENTS[c].substitute.priceMult;
            used.push(c);
            if (frac > 0) degradedFrac = Math.max(degradedFrac, subFrac / frac);
          }
        }
        if (st.testHours) hoursLeft[campus] = Math.max(0, hoursLeft[campus] - through * st.testHours * testMult);
        if (i > 0) line.wip[i - 1] = Math.max(0, line.wip[i - 1] - through);
        const passed = through * stageYield(s, id, i);
        if (i < stages.length - 1) line.wip[i] += passed;
        else good = passed;
        stageLast.push({ cap: round2(cap), throughput: round2(through), scrap: round2(through - passed), limit: through >= cap * 0.995 ? 'capacity' : why });
      }
      line.wip = line.wip.map(round2);
      line.stages = stageLast;

      const total = good + line.partial;
      let out = Math.floor(total + 1e-9);
      line.partial = total - out;

      // Quality: wear, quality systems and commercial-grade parts drive faults.
      let quarantined = 0;
      const commercial = used.includes('microelectronics') ? 1.4 : 1;
      const faultP = (Math.max(0, line.wear - 25) / 150) * (1 - 0.3 * line.upgrades.quality) * commercial * qualityMult(s);
      if (out > 0 && rand(s) < faultP) {
        quarantined = Math.max(1, Math.round(out * randRange(s, 0.15, 0.35)));
        out -= quarantined;
        line.quarantine.push({ qty: quarantined, monthsLeft: 3 });
        messages.push({ tone: 'warn', text: `Quality fault at ${CAMPUSES[campus].name}: ${fmt(quarantined)} ${def.name} quarantined for inspection.` });
      }
      line.experience += out;

      // Allocation: test & evaluation, then partners, then the reserve.
      let degraded = Math.round(out * degradedFrac);
      let full = out - degraded;
      const tested = Math.min(out, Math.round(out * line.testShare));
      const testFull = Math.min(full, tested);
      full -= testFull;
      degraded -= tested - testFull;
      const deliv = deliverToPartners(s, id, full + degraded);
      revenue += deliv.revenue;
      const pFull = Math.min(full, deliv.delivered);
      full -= pFull;
      degraded -= deliv.delivered - pFull;
      const r = s.reserves[id];
      r.stock += full;
      r.degraded += degraded;
      r.made += full + degraded;
      output[id] = out;

      // Thin lot testing lets latent defects slip into the reserve.
      if (line.testShare < MIN_SAFE_TEST_SHARE) line.latentRisk = Math.min(1, line.latentRisk + (MIN_SAFE_TEST_SHARE - line.testShare) * 4);
      else line.latentRisk *= 0.6;
      if (line.latentRisk > 0 && rand(s) < line.latentRisk * 0.25 && r.stock > 0) {
        const recalled = Math.max(1, Math.round(r.stock * 0.08));
        r.stock -= recalled;
        line.latentRisk = 0;
        s.confidence = clamp(s.confidence - 3);
        messages.push({ tone: 'bad', text: `Recall: a latent defect turns up in fielded ${def.name}. ${fmt(recalled)} pulled from the reserve. More lot testing would have caught it.` });
      }

      const strike = s.campuses[campus].strikeMonths > 0;
      line.last = {
        output: out,
        degraded: Math.round(out * degradedFrac),
        quarantined,
        tested,
        toPartners: deliv.delivered,
        toReserve: full + degraded,
        staffing: staffed[campus],
        limit: strike ? 'strike' : partsLimit && stageLast.some((x) => x.limit === 'parts') ? partsLimit : testsLimited ? 'tests' : staffed[campus] < 0.98 ? 'crew' : 'capacity',
        usedSubstitutes: [...new Set(used)],
      };
    }
  }

  for (const id of LINE_IDS) {
    const line = s.lines[id];
    if (line.run === 'idle' || line.tranches.length === 0) {
      line.last = { output: 0, degraded: 0, quarantined: 0, tested: 0, toPartners: 0, toReserve: 0, staffing: staffed[LINES[id].campus], limit: 'idle', usedSubstitutes: [] };
      line.stages = STAGES[id].map(() => ({ cap: 0, throughput: 0, scrap: 0, limit: null }));
    }
  }
  for (const c of COMPONENT_IDS) {
    const cs = s.components[c];
    cs.stock = round2(cs.stock);
    cs.lastUsed = round2(cs.lastUsed);
    cs.lastShort = round2(Math.max(0, cs.lastShort));
    cs.lastSubstituted = round2(cs.lastSubstituted);
  }
  return { output, componentSpend, revenue };
}
